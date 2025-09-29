import asyncio
import threading
import json
import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import yaml
from dotenv import load_dotenv
from pathlib import Path
import sys
import os
import uuid
import shutil
import glob
import time

# Add the current directory to Python path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from mcp_servers.multiMCP import MultiMCP
from agentLoop.flow import AgentLoop4
from agentLoop.output_analyzer import analyze_results

app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)  # Enable CORS for frontend integration

# Global variables to store initialized components
multi_mcp = None
agent_loop = None
initialization_complete = False

# --- Persistent event loop for all async agent operations ---
event_loop = None

def start_background_loop(loop):
    asyncio.set_event_loop(loop)
    loop.run_forever()

def run_in_loop(coro):
    future = asyncio.run_coroutine_threadsafe(coro, event_loop)
    return future.result()

# ---

def load_server_configs():
    """Load MCP server configurations from YAML file"""
    config_path = Path("config/mcp_server_config.yaml")
    if not config_path.exists():
        print(f"MCP server config not found: {config_path}")
        return []
    
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
    
    return config.get("mcp_servers", [])

async def initialize_agent_system():
    """Initialize the agent system components"""
    global multi_mcp, agent_loop, initialization_complete
    
    try:
        # Load environment variables
        load_dotenv()
        
        # Load server configs and initialize MultiMCP
        print("📥 Loading MCP Servers...")
        server_configs = load_server_configs()
        multi_mcp = MultiMCP(server_configs)
        await multi_mcp.initialize()
        
        # Initialize AgentLoop4
        agent_loop = AgentLoop4(multi_mcp)
        initialization_complete = True
        print("✅ Agent system initialized successfully")
        return True
        
    except Exception as e:
        print(f"❌ Failed to initialize agent system: {e}")
        traceback.print_exc()
        initialization_complete = False
        return False

# --- New global variables for real-time status updates ---
current_execution_context = None
context_lock = threading.Lock()
current_session_id = None
current_agent_state = "idle"
# ---

async def agent_responds(query, uploaded_files=None, file_manifest=None):
    """
    Wrapper function to invoke the agent system
    This is a replica function that doesn't disturb existing agent code
    """
    global multi_mcp, agent_loop, initialization_complete, current_execution_context, current_session_id, current_agent_state

    if not initialization_complete or agent_loop is None:
        return "Agent system is not initialized. Please restart the server."

    try:
        if uploaded_files is None:
            uploaded_files = []
        if file_manifest is None:
            file_manifest = []

        import time
        current_session_id = f"session_{int(time.time())}"

        def store_context(context):
            global current_execution_context, current_agent_state
            with context_lock:
                current_execution_context = context
                current_agent_state = "running"

        print(f"🔄 Processing query: {query}")
        execution_context = await agent_loop.run_with_status_callback(
            query, file_manifest, uploaded_files, store_context
        )

        if hasattr(execution_context, 'get_final_output'):
            final_output = execution_context.get_final_output()
        else:
            final_output = "Task completed successfully. Check the execution context for detailed results."

        with context_lock:
            current_agent_state = "completed"

        return final_output

    except Exception as e:
        error_msg = f"Error processing query: {str(e)}"
        print(f"❌ {error_msg}")
        traceback.print_exc()
        return error_msg

def is_agent_busy():
    """Check if an agent is currently running"""
    global current_execution_context
    with context_lock:
        if current_execution_context is None:
            return False
        return not current_execution_context.all_done()

def get_agent_status():
    global current_execution_context, current_session_id, current_agent_state
    with context_lock:
        if current_agent_state == "starting":
            return {
                'status': 'starting',
                'message': 'Agent is starting...'
            }
        if current_execution_context is None:
            return {
                'status': 'idle',
                'message': 'No agent execution in progress'
            }
        context = current_execution_context
        nodes = [node_id for node_id in context.plan_graph.nodes if node_id != "ROOT"]
        plan = []
        current_step = None
        for node_id in nodes:
            node_data = context.plan_graph.nodes[node_id]
            step_info = {
                'id': node_id,
                'description': node_data.get('description', 'Unknown step'),
                'agent': node_data.get('agent', 'Unknown agent'),
                'status': node_data.get('status', 'pending')
            }
            plan.append(step_info)
            if node_data.get('status') == 'running':
                current_step = step_info
        total_steps = len(plan)
        completed_steps = sum(1 for step in plan if step['status'] == 'completed')
        failed_steps = sum(1 for step in plan if step['status'] == 'failed')
        percentage = int((completed_steps / total_steps * 100) if total_steps > 0 else 0)
        execution_time = 0
        if hasattr(context, 'start_time'):
            import time
            execution_time = int(time.time() - context.start_time)
        status = 'completed' if context.all_done() else 'running'
        # Add edges for minimal DAG
        edges = []
        for source, target in context.plan_graph.edges():
            if source != "ROOT":
                edges.append({'source': source, 'target': target})
        return {
            'status': status,
            'session_id': current_session_id,
            'progress': {
                'completed': completed_steps,
                'total': total_steps,
                'percentage': percentage
            },
            'completed_steps': completed_steps,
            'failed_steps': failed_steps,
            'execution_time': execution_time,
            'current_step': current_step,
            'plan': plan,
            'edges': edges
        }

@app.route('/ask', methods=['POST'])
def ask():
    """Handle chat requests from the frontend"""
    global current_agent_state
    try:
        # PATCH: Handle multipart/form-data for file uploads
        if request.content_type and request.content_type.startswith('multipart/form-data'):
            question = request.form.get('question', '')
            files = request.files.getlist('files')
        else:
            data = request.get_json(silent=True)
            if not data or 'question' not in data:
                return jsonify({'response': 'Invalid request: missing "question"'}), 400
            question = data['question']
            files = []

        # PATCH: Save uploaded files to temp_files/{session_id}/
        import time, os
        session_id = f"session_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        temp_dir = os.path.join('temp_files', session_id)
        os.makedirs(temp_dir, exist_ok=True)
        uploaded_files = []
        file_manifest = []
        for file in files:
            save_path = os.path.join(temp_dir, file.filename)
            file.save(save_path)
            uploaded_files.append(save_path)
            file_manifest.append({
                'name': file.filename,
                'path': save_path,
                'size': os.path.getsize(save_path),
                'type': file.content_type
            })

        print(f" Received question: {question}")
        with context_lock:
            current_agent_state = "starting"

        # Run the agent asynchronously
        answer = run_in_loop(agent_responds(question, uploaded_files, file_manifest))

        # --- NEW: Add structured analysis results for chat UI ---
        from agentLoop.output_analyzer import analyze_results_web
        with context_lock:
            context = current_execution_context
        if context is not None:
            analysis = analyze_results_web(context)
        else:
            analysis = {"error": "No execution context available"}

        return jsonify({
            'response': answer,
            'status': 'success',
            'analysis': analysis
        })

    except Exception as e:
        error_msg = f"Server error: {str(e)}"
        print(f"\u274c {error_msg}")
        return jsonify({
            'response': error_msg,
            'status': 'error'
        }), 500

@app.route('/status', methods=['GET'])
def get_status():
    """Get current agent execution status"""
    try:
        status = get_agent_status()
        return jsonify(status)
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error getting status: {str(e)}'
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    global initialization_complete
    return jsonify({
        'status': 'healthy' if initialization_complete else 'initializing',
        'message': 'EAG18 Web API is running',
        'agent_initialized': initialization_complete
    })

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/memory/<path:filename>')
def serve_memory_file(filename):
    return send_from_directory('memory', filename)

@app.route('/list-reports', methods=['GET'])
def list_reports():
    report_files = glob.glob('memory/**/*.html', recursive=True)
    reports = []
    for f in report_files:
        try:
            mtime = os.path.getmtime(f)
        except Exception:
            mtime = 0
        reports.append({'path': os.path.relpath(f, 'memory'), 'mtime': mtime})
    return jsonify({'reports': reports})

@app.route('/list-code-outputs', methods=['GET'])
def list_code_outputs():
    # Fix: Look for all directories in media/generated, not just session_*
    session_dirs = glob.glob('media/generated/*')
    sessions = []
    for session_dir in session_dirs:
        if os.path.isdir(session_dir):
            files = []
            for root, _, filenames in os.walk(session_dir):
                for fname in filenames:
                    fpath = os.path.join(root, fname)
                    rel_path = os.path.relpath(fpath, session_dir)
                    try:
                        mtime = os.path.getmtime(fpath)
                    except Exception:
                        mtime = 0
                    files.append({'path': rel_path, 'mtime': mtime})
            sessions.append({
                'session': os.path.basename(session_dir),
                'files': files
            })
    return jsonify({'sessions': sessions})

@app.route('/media/generated/<session_id>/<path:filename>')
def serve_generated_file(session_id, filename):
    """Serve files from the generated media directory"""
    file_path = os.path.join('media', 'generated', session_id, filename)
    if os.path.exists(file_path):
        return send_from_directory('media/generated', f'{session_id}/{filename}')
    else:
        return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    print(" Starting EAG18 Web API...")
    
    # Start persistent event loop in background thread
    event_loop = asyncio.new_event_loop()
    t = threading.Thread(target=start_background_loop, args=(event_loop,), daemon=True)
    t.start()

    # Initialize agent system on the persistent event loop
    print(" Initializing agent system at startup...")
    success = run_in_loop(initialize_agent_system())
    
    if success:
        print("✅ Agent system ready. Starting Flask server...")
        app.run(debug=True, host='0.0.0.0', port=5000)
    else:
        print("❌ Failed to initialize agent system. Exiting...")
        sys.exit(1)