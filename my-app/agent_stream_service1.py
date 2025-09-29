# # agent_stream_service.py
# import asyncio
# import json
# from typing import AsyncGenerator, Dict, Any
# from dataclasses import dataclass
# from enum import Enum
# import sys
# import io
# from contextlib import redirect_stdout, redirect_stderr
# import re
# import time
# from pathlib import Path
# import yaml
# from dotenv import load_dotenv

# # Import your existing modules
# from utils.utils import log_step, log_error
# from mcp_servers.multiMCP import MultiMCP
# from agentLoop.flow import AgentLoop4
# from agentLoop.output_analyzer import analyze_results

# class EventType(Enum):
#     BATCH_START = "batch_start"
#     AGENT_EXECUTING = "agent_executing" 
#     TASK_COMPLETED = "task_completed"
#     DAG_UPDATE = "dag_update"
#     LOG_UPDATE = "log_update"
#     EXECUTION_COMPLETE = "execution_complete"
#     ERROR = "error"

# @dataclass
# class StreamEvent:
#     event_type: EventType
#     data: Dict[str, Any]
#     timestamp: float

# class OutputCapture:
#     """Capture and parse console output for streaming"""
#     def __init__(self, event_callback):
#         self.event_callback = event_callback
#         self.buffer = []
#         self.original_stdout = sys.stdout
#         self.original_stderr = sys.stderr
        
#     def write(self, text):
#         # Write to original stdout
#         self.original_stdout.write(text)
#         self.original_stdout.flush()
        
#         # Store for processing
#         self.buffer.append(text)
        
#         # Process line by line
#         if '\n' in text:
#             lines = ''.join(self.buffer).split('\n')
#             self.buffer = [lines[-1]]  # Keep incomplete line
            
#             for line in lines[:-1]:
#                 if line.strip():
#                     asyncio.create_task(self._parse_and_emit(line.strip()))
    
#     def flush(self):
#         self.original_stdout.flush()
    
#     async def _parse_and_emit(self, line: str):
#         """Parse a line of output and emit appropriate events"""
#         try:
#             # Parse batch execution
#             if "🚀 Executing batch:" in line:
#                 batch_match = re.search(r"🚀 Executing batch: \['(.+?)'\]", line)
#                 if batch_match:
#                     await self.event_callback(EventType.BATCH_START, {
#                         "batch": batch_match.group(1),
#                         "message": line
#                     })
            
#             # Parse agent execution
#             elif "🟢 💬" in line:
#                 agent_match = re.search(r"🟢 💬 (\w+Agent) \((.+?)\)", line)
#                 if agent_match:
#                     await self.event_callback(EventType.AGENT_EXECUTING, {
#                         "agent": agent_match.group(1),
#                         "type": agent_match.group(2),
#                         "message": line
#                     })
            
#             # Parse task completion
#             elif "📦 ✅" in line and "completed" in line:
#                 task_match = re.search(r"📦 ✅ (\w+) completed", line)
#                 if task_match:
#                     await self.event_callback(EventType.TASK_COMPLETED, {
#                         "task": task_match.group(1),
#                         "message": line
#                     })
            
#             # Parse DAG content
#             elif any(indicator in line for indicator in ["🤖 Agent Execution DAG", "│", "├──", "└──", "╭─", "╰─"]):
#                 await self.event_callback(EventType.DAG_UPDATE, {
#                     "dag_line": line,
#                     "message": "DAG updated"
#                 })
            
#             # General log update
#             else:
#                 await self.event_callback(EventType.LOG_UPDATE, {
#                     "message": line,
#                     "level": "info"
#                 })
                
#         except Exception as e:
#             print(f"Error parsing line: {e}")

# class AgentStreamService:
#     def __init__(self):
#         self.multi_mcp = None
#         self.agent_loop = None
#         self.initialized = False
#         self.active_streams = set()

#     async def initialize(self):
#         """Initialize the agent service"""
#         if self.initialized:
#             return
            
#         load_dotenv()
        
#         # Load server configs and initialize MultiMCP
#         server_configs = self.load_server_configs()
#         self.multi_mcp = MultiMCP(server_configs)
#         await self.multi_mcp.initialize()
        
#         # Initialize AgentLoop4 (without set_stream_callback)
#         self.agent_loop = AgentLoop4(self.multi_mcp)
#         self.initialized = True

#     def load_server_configs(self):
#         """Load MCP server configurations from YAML file"""
#         config_path = Path("config/mcp_server_config.yaml")
#         if not config_path.exists():
#             log_error(f"MCP server config not found: {config_path}")
#             return []
        
#         with open(config_path, "r") as f:
#             config = yaml.safe_load(f)
        
#         return config.get("mcp_servers", [])

#     async def emit_event(self, event_type: EventType, data: Dict[str, Any]):
#         """Emit an event to all active streams"""
#         event = StreamEvent(
#             event_type=event_type,
#             data=data,
#             timestamp=time.time()
#         )
        
#         # Notify all active streams
#         for stream_queue in list(self.active_streams):
#             try:
#                 await stream_queue.put(event)
#             except:
#                 # Remove broken streams
#                 self.active_streams.discard(stream_queue)

#     async def process_query_stream(self, query: str, uploaded_files: list = None, file_manifest: list = None) -> AsyncGenerator[str, None]:
#         """Process query and yield streaming events"""
#         if not self.initialized:
#             await self.initialize()
        
#         # Create stream-specific queue
#         stream_queue = asyncio.Queue()
#         self.active_streams.add(stream_queue)
        
#         try:
#             # Use empty lists if no files provided
#             uploaded_files = uploaded_files or []
#             file_manifest = file_manifest or []
            
#             # Start processing in background with output capture
#             process_task = asyncio.create_task(
#                 self._process_with_output_capture(query, file_manifest, uploaded_files)
#             )
            
#             # Yield events as they come
#             while True:
#                 try:
#                     # Wait for either an event or task completion
#                     done, pending = await asyncio.wait(
#                         [
#                             asyncio.create_task(stream_queue.get()),
#                             process_task
#                         ],
#                         return_when=asyncio.FIRST_COMPLETED,
#                         timeout=0.1
#                     )
                    
#                     if process_task in done:
#                         # Processing complete, yield any remaining events
#                         try:
#                             while True:
#                                 event = stream_queue.get_nowait()
#                                 yield self._format_sse_event(event)
#                         except asyncio.QueueEmpty:
#                             pass
                        
#                         # Get final result
#                         try:
#                             result = await process_task
#                             final_event = StreamEvent(
#                                 event_type=EventType.EXECUTION_COMPLETE,
#                                 data=result,
#                                 timestamp=time.time()
#                             )
#                             yield self._format_sse_event(final_event)
#                         except Exception as e:
#                             error_event = StreamEvent(
#                                 event_type=EventType.ERROR,
#                                 data={"error": str(e)},
#                                 timestamp=time.time()
#                             )
#                             yield self._format_sse_event(error_event)
#                         break
                    
#                     for task in done:
#                         if task != process_task:
#                             event = await task
#                             yield self._format_sse_event(event)
                    
#                     # Cancel pending tasks
#                     for task in pending:
#                         task.cancel()
                        
#                 except asyncio.TimeoutError:
#                     # Check if process is still running
#                     if process_task.done():
#                         break
#                     continue
                    
#         except Exception as e:
#             error_event = StreamEvent(
#                 event_type=EventType.ERROR,
#                 data={"error": str(e)},
#                 timestamp=time.time()
#             )
#             yield self._format_sse_event(error_event)
#         finally:
#             self.active_streams.discard(stream_queue)

#     async def _process_with_output_capture(self, query: str, file_manifest: list, uploaded_files: list):
#         """Process query with output capture"""
#         try:
#             # Setup output capture
#             output_capture = OutputCapture(self.emit_event)
            
#             # Temporarily redirect stdout
#             original_stdout = sys.stdout
#             sys.stdout = output_capture
            
#             try:
#                 # Emit start event
#                 await self.emit_event(EventType.LOG_UPDATE, {
#                     "message": "🔄 Processing with AgentLoop4...",
#                     "level": "info"
#                 })
                
#                 # Process with AgentLoop4 (using existing interface)
#                 execution_context = await self.agent_loop.run(query, file_manifest, uploaded_files)
                
#                 # Capture analyze_results output
#                 await self.emit_event(EventType.LOG_UPDATE, {
#                     "message": "📊 Analyzing results...",
#                     "level": "info"
#                 })
                
#                 # Analyze results with output capture
#                 analysis_output = io.StringIO()
#                 with redirect_stdout(analysis_output):
#                     analyze_results(execution_context)
                
#                 analysis_result = analysis_output.getvalue()
                
#                 return {
#                     "success": True,
#                     "execution_context": execution_context,
#                     "analysis_result": analysis_result,
#                     "message": "Query processed successfully"
#                 }
                
#             finally:
#                 # Restore original stdout
#                 sys.stdout = original_stdout
                
#         except Exception as e:
#             await self.emit_event(EventType.ERROR, {
#                 "error": str(e),
#                 "message": "Failed to process query"
#             })
#             return {
#                 "success": False,
#                 "error": str(e),
#                 "message": "Failed to process query"
#             }

#     def _format_sse_event(self, event: StreamEvent) -> str:
#         """Format event as SSE"""
#         data = {
#             "type": event.event_type.value,
#             "data": event.data,
#             "timestamp": event.timestamp
#         }
#         return f"data: {json.dumps(data)}\n\n"

#     async def shutdown(self):
#         """Shutdown the agent service"""
#         if self.multi_mcp:
#             await self.multi_mcp.shutdown()
#         self.initialized = False

# # Global streaming agent service
# agent_stream_service = AgentStreamService()

# agent_stream_service.py - Fixed version with better error handling
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

class AgentStreamService:
    def __init__(self):
        self.multi_mcp = None
        self.agent_loop = None
        self.initialized = False

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

    async def process_query_stream(self, query: str, uploaded_files: list = None, file_manifest: list = None) -> AsyncGenerator[str, None]:
        """Process query and yield streaming events"""
        if not self.initialized:
            await self.initialize()
        
        # Use empty lists if no files provided
        uploaded_files = uploaded_files or []
        file_manifest = file_manifest or []
        
        try:
            # Yield start event
            start_event = {
                "type": "processing_start",
                "data": {"message": "Starting agent processing..."},
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(start_event)}\n\n"
            
            # Simple approach: capture output and process synchronously
            result = await self._process_with_simple_capture(query, file_manifest, uploaded_files)
            
            # Yield completion event
            completion_event = {
                "type": EventType.EXECUTION_COMPLETE.value,
                "data": result,
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(completion_event)}\n\n"
            
        except Exception as e:
            print(f"Process query stream error: {e}")
            traceback.print_exc()
            error_event = {
                "type": EventType.ERROR.value,
                "data": {"error": str(e)},
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(error_event)}\n\n"

    async def _process_with_simple_capture(self, query: str, file_manifest: list, uploaded_files: list):
        """Simplified processing with basic output capture"""
        try:
            # Process with AgentLoop4
            print("🔄 Processing with AgentLoop4...")
            
            # Run the agent loop
            execution_context = await self.agent_loop.run(query, file_manifest, uploaded_files)
            
            # Analyze results
            print("📊 Analyzing results...")
            analysis_output = io.StringIO()
            
            # Capture analyze_results output
            original_stdout = sys.stdout
            try:
                sys.stdout = analysis_output
                analyze_results(execution_context)
            finally:
                sys.stdout = original_stdout
            
            analysis_result = analysis_output.getvalue()
            
            return {
                "success": True,
                "execution_context": str(execution_context),  # Convert to string for JSON serialization
                "analysis_result": analysis_result,
                "message": "Query processed successfully"
            }
            
        except Exception as e:
            print(f"Process error: {e}")
            traceback.print_exc()
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