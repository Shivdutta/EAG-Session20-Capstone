# agent_stream_service.py - Fixed version with emoji cleaning for frontend
import asyncio
import json
from typing import AsyncGenerator, Dict, Any
from dataclasses import dataclass
from enum import Enum
import sys
import io
import re
import time
import traceback
from pathlib import Path
import yaml
from dotenv import load_dotenv

# Import your existing modules
from utils.utils import log_step, log_error
from mcp_servers.multiMCP import MultiMCP
from agentLoop.flow import AgentLoop4
from agentLoop.output_analyzer import analyze_results

class EventType(Enum):
    BATCH_START = "batch_start"
    AGENT_EXECUTING = "agent_executing" 
    TASK_COMPLETED = "task_completed"
    DAG_UPDATE = "dag_update"
    LOG_UPDATE = "log_update"
    EXECUTION_COMPLETE = "execution_complete"
    ERROR = "error"

@dataclass
class StreamEvent:
    event_type: EventType
    data: Dict[str, Any]
    timestamp: float

class StreamOutputCapture:
    """Capture stdout and emit clean events to frontend"""
    def __init__(self, event_callback):
        self.event_callback = event_callback
        self.buffer = []
        self.original_stdout = sys.stdout
        
    def write(self, text):
        # Write to original stdout (keep console output)
        self.original_stdout.write(text)
        self.original_stdout.flush()
        
        # Store for streaming processing
        self.buffer.append(text)
        
        # Process line by line for streaming
        if '\n' in text:
            lines = ''.join(self.buffer).split('\n')
            self.buffer = [lines[-1]]  # Keep incomplete line
            
            for line in lines[:-1]:
                if line.strip():
                    asyncio.create_task(self._process_line(line.strip()))
    
    def flush(self):
        self.original_stdout.flush()
        
    def clean_emojis(self, text: str) -> str:
        """Remove emojis and replace with clean text for frontend"""
        # Replace common emojis with text equivalents
        replacements = {
            '🟢': '>>',
            '💬': '',
            '📦': '',
            '✅': 'COMPLETED',
            '🚀': '>>',
            '⚙️': '',
            '🔧': '',
            '🚨': 'ALERT',
            '❌': 'ERROR',
            '⚠️': 'WARNING',
            '📄': '',
            '📊': '',
        }
        
        cleaned = text
        for emoji, replacement in replacements.items():
            cleaned = cleaned.replace(emoji, replacement)
            
        # Remove any remaining emojis (fallback)
        cleaned = re.sub(r'[^\x00-\x7F]+', '', cleaned)
        
        return cleaned.strip()
    
    async def _process_line(self, line: str):
        """Process a line and emit streaming events"""
        try:
            # Clean the line for frontend
            clean_line = self.clean_emojis(line)
            
            # Detect agent execution
            if 'Agent' in clean_line and ('(text only)' in clean_line or '(code)' in clean_line):
                agent_match = re.search(r'(\w+Agent)', clean_line)
                if agent_match:
                    await self.event_callback('agent_executing', {
                        'agent': agent_match.group(1),
                        'message': clean_line
                    })
                    return
            
            # Detect task completion
            if 'completed' in clean_line and re.search(r'T\d+', clean_line):
                task_match = re.search(r'(T\d+)', clean_line)
                if task_match:
                    await self.event_callback('task_completed', {
                        'task': task_match.group(1),
                        'message': clean_line
                    })
                    return
            
            # Detect batch execution
            if 'Executing batch:' in clean_line:
                await self.event_callback('batch_start', {
                    'message': clean_line
                })
                return
            
            # General log message
            if clean_line and len(clean_line) > 3:
                await self.event_callback('log_update', {
                    'message': clean_line,
                    'level': 'info'
                })
                
        except Exception as e:
            print(f"Error processing line: {e}")

class AgentStreamService:
    def __init__(self):
        self.multi_mcp = None
        self.agent_loop = None
        self.initialized = False
        self.active_callbacks = []

    async def initialize(self):
        """Initialize the agent service"""
        if self.initialized:
            return
            
        try:
            load_dotenv()
            
            # Load server configs and initialize MultiMCP
            server_configs = self.load_server_configs()
            self.multi_mcp = MultiMCP(server_configs)
            await self.multi_mcp.initialize()
            
            # Initialize AgentLoop4
            self.agent_loop = AgentLoop4(self.multi_mcp)
            self.initialized = True
            print("✅ Agent service initialized successfully")
            
        except Exception as e:
            print(f"❌ Failed to initialize agent service: {e}")
            traceback.print_exc()
            raise

    def load_server_configs(self):
        """Load MCP server configurations from YAML file"""
        config_path = Path("config/mcp_server_config.yaml")
        if not config_path.exists():
            log_error(f"MCP server config not found: {config_path}")
            return []
        
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        
        return config.get("mcp_servers", [])

    async def stream_callback(self, event_type: str, data: Dict[str, Any]):
        """Callback for streaming events"""
        for callback in self.active_callbacks:
            try:
                await callback(event_type, data)
            except:
                pass  # Remove failed callbacks later

    async def process_query_stream(self, query: str, uploaded_files: list = None, file_manifest: list = None) -> AsyncGenerator[str, None]:
        """Process query and yield clean streaming events"""
        if not self.initialized:
            await self.initialize()
        
        # Use empty lists if no files provided
        uploaded_files = uploaded_files or []
        file_manifest = file_manifest or []
        
        # Stream queue for this request
        event_queue = asyncio.Queue()
        
        async def queue_callback(event_type: str, data: Dict[str, Any]):
            await event_queue.put({
                'type': event_type,
                'data': data,
                'timestamp': time.time()
            })
        
        self.active_callbacks.append(queue_callback)
        
        try:
            # Yield start event
            start_event = {
                "type": "processing_start",
                "data": {"message": "Starting agent processing"},
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(start_event)}\n\n"
            
            # Start processing in background
            process_task = asyncio.create_task(
                self._process_with_stream_capture(query, file_manifest, uploaded_files, queue_callback)
            )
            
            # Stream events as they come
            while not process_task.done():
                try:
                    # Wait for either an event or task completion
                    event = await asyncio.wait_for(event_queue.get(), timeout=0.1)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    print(f"Stream error: {e}")
                    break
            
            # Get remaining events
            try:
                while True:
                    event = event_queue.get_nowait()
                    yield f"data: {json.dumps(event)}\n\n"
            except asyncio.QueueEmpty:
                pass
            
            # Get final result
            try:
                result = await process_task
                completion_event = {
                    "type": "execution_complete",
                    "data": result,
                    "timestamp": time.time()
                }
                yield f"data: {json.dumps(completion_event)}\n\n"
            except Exception as e:
                error_event = {
                    "type": "error",
                    "data": {"error": str(e)},
                    "timestamp": time.time()
                }
                yield f"data: {json.dumps(error_event)}\n\n"
            
        except Exception as e:
            print(f"Process query stream error: {e}")
            traceback.print_exc()
            error_event = {
                "type": "error",
                "data": {"error": str(e)},
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(error_event)}\n\n"
        finally:
            # Clean up
            if queue_callback in self.active_callbacks:
                self.active_callbacks.remove(queue_callback)

    async def _process_with_stream_capture(self, query: str, file_manifest: list, uploaded_files: list, callback):
        """Process query with streaming output capture"""
        try:
            # Setup output capture
            output_capture = StreamOutputCapture(callback)
            
            # Emit processing start
            await callback('log_update', {
                'message': 'Processing with AgentLoop4',
                'level': 'info'
            })
            
            # Redirect stdout to capture agent output
            original_stdout = sys.stdout
            try:
                sys.stdout = output_capture
                
                # Run the agent loop
                execution_context = await self.agent_loop.run(query, file_manifest, uploaded_files)
                
            finally:
                # Restore stdout
                sys.stdout = original_stdout
            
            # Analyze results
            await callback('log_update', {
                'message': 'Analyzing results',
                'level': 'info'
            })
            
            analysis_output = io.StringIO()
            original_stdout = sys.stdout
            try:
                sys.stdout = analysis_output
                analyze_results(execution_context)
            finally:
                sys.stdout = original_stdout
            
            analysis_result = analysis_output.getvalue()
            
            return {
                "success": True,
                "message": "Query processed successfully",
                "analysis_summary": analysis_result[:500] + "..." if len(analysis_result) > 500 else analysis_result
            }
            
        except Exception as e:
            print(f"Process error: {e}")
            traceback.print_exc()
            await callback('error', {
                'error': str(e),
                'message': 'Failed to process query'
            })
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to process query"
            }

    async def shutdown(self):
        """Shutdown the agent service"""
        try:
            if self.multi_mcp:
                await self.multi_mcp.shutdown()
            self.initialized = False
            print("✅ Agent service shutdown successfully")
        except Exception as e:
            print(f"❌ Error during shutdown: {e}")

# Global streaming agent service
agent_stream_service = AgentStreamService()