from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
import json
import os
import sys
from pathlib import Path
from enum import Enum
from jinja2 import Environment, FileSystemLoader
from pathlib import Path
from typing import Dict
import ast
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager

# Add the parent directory to Python path
parent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(parent_dir))

from contextlib import asynccontextmanager
from agentLoop.model_manager import ModelManager  # Replace with actual import path

# Import the fixed agent service
from agent_stream_service import agent_stream_service, EventType

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan"""
    # Startup
    try:
        await agent_stream_service.initialize()
        print("✅ Agent streaming service initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize agent service: {e}")
        # Don't raise the exception - let the app start even if agent service fails
    
    yield  # Application runs here
    
    # Shutdown
    try:
        await agent_stream_service.shutdown()
        print("✅ Agent service shutdown successfully")
    except Exception as e:
        print(f"❌ Error during agent service shutdown: {e}")

# Create FastAPI app with lifespan
app = FastAPI(
    title="SIP Calculator API", 
    version="1.0.0",
    lifespan=lifespan
)

# app = FastAPI(title="SIP Goal Planning API", version="1.0.0")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load configuration from JSON file
def load_sip_config() -> Dict[str, Any]:
    """Load SIP configuration from sip_ui_binding.json file"""
    config_file = Path(__file__).parent / "sip_ui_binding.json"
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        print(f"✅ Successfully loaded configuration from {config_file}")
        return config
    except FileNotFoundError:
        print(f"❌ Configuration file not found: {config_file}")
        print("📁 Please ensure 'sip_ui_binding.json' is in the same directory as this script")
        raise HTTPException(
            status_code=500,
            detail=f"Configuration file not found: {config_file}. Please ensure 'sip_ui_binding.json' exists."
        )
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in configuration file: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Invalid JSON in configuration file: {e}"
        )
    except Exception as e:
        print(f"❌ Error loading configuration: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error loading configuration: {e}"
        )

# Load configuration at module level
try:
    SIP_CONFIG = load_sip_config()
except Exception as e:
    print(f"⚠️  Warning: Could not load configuration at startup: {e}")
    SIP_CONFIG = None

# Dynamically create enums from JSON configuration
def create_dynamic_enums():
    """Create enums dynamically from the loaded configuration"""
    global GoalType, Currency, RiskAppetite
    
    if SIP_CONFIG is None:
        # Fallback to default enums if config not loaded
        class GoalType(str, Enum):
            RETIREMENT = "Retirement"
            CHILD_EDUCATION = "Child Education"
            CHILD_MARRIAGE = "Child Marriage"
            HOUSE_PURCHASE = "House Purchase"
            GENERAL_WEALTH = "General Wealth Creation"
        
        class Currency(str, Enum):
            INR = "INR"
            USD = "USD"
            EUR = "EUR"
        
        class RiskAppetite(str, Enum):
            VERY_LOW = "very_low"
            LOW = "low"
            LOW_MODERATE = "low_moderate"
            MODERATE = "moderate"
            HIGH_MODERATE = "high_moderate"
            HIGH = "high"
            VERY_HIGH = "very_high"
        return

    try:
        # Extract goal types from configuration
        conditional_fields = SIP_CONFIG["formConfig"]["fields"]["conditional_fields"]
        goal_types = {key.replace(" ", "_").replace("-", "_").upper(): key for key in conditional_fields.keys()}
        GoalType = Enum("GoalType", goal_types, type=str)
        
        # Extract currencies from configuration
        currency_options = {}
        for field in SIP_CONFIG["formConfig"]["fields"]["always_required"]:
            if field["name"] == "currency" and "options" in field:
                for option in field["options"]:
                    currency_options[option["value"]] = option["value"]
        Currency = Enum("Currency", currency_options, type=str)
        
        # Extract risk appetites from configuration
        risk_options = {}
        for field in SIP_CONFIG["formConfig"]["fields"]["always_required"]:
            if field["name"] == "risk_appetite" and "options" in field:
                for option in field["options"]:
                    risk_options[option["value"].upper()] = option["value"]
        RiskAppetite = Enum("RiskAppetite", risk_options, type=str)
        
    except Exception as e:
        print(f"⚠️ Warning: Could not create dynamic enums: {e}. Using fallback enums.")
        # Fallback enums
        class GoalType(str, Enum):
            RETIREMENT = "Retirement"
            CHILD_EDUCATION = "Child Education"
            CHILD_MARRIAGE = "Child Marriage"
            HOUSE_PURCHASE = "House Purchase"
            GENERAL_WEALTH = "General Wealth Creation"
        
        class Currency(str, Enum):
            INR = "INR"
            USD = "USD"
            EUR = "EUR"
        
        class RiskAppetite(str, Enum):
            VERY_LOW = "very_low"
            LOW = "low"
            LOW_MODERATE = "low_moderate"
            MODERATE = "moderate"
            HIGH_MODERATE = "high_moderate"
            HIGH = "high"
            VERY_HIGH = "very_high"

# Create enums
create_dynamic_enums()

# Pydantic models for request/response
class FormDataBase(BaseModel):
    goal_type: str  # Changed from GoalType to str for flexibility
    current_age: int = Field(ge=18, le=80)
    currency: str = "INR"  # Changed from Currency to str for flexibility
    target_amount_min: float = Field(ge=1000)
    risk_appetite: str  # Changed from RiskAppetite to str for flexibility

class RetirementData(FormDataBase):
    retirement_age: int = Field(ge=50, le=80)
    
    @validator('retirement_age')
    def validate_retirement_age(cls, v, values):
        if 'current_age' in values and v <= values['current_age']:
            raise ValueError('Retirement age must be greater than current age')
        return v

class ChildEducationData(FormDataBase):
    child_current_age: int = Field(ge=0, le=25)
    education_start_age: int = Field(ge=16, le=30)
    
    @validator('education_start_age')
    def validate_education_start_age(cls, v, values):
        if 'child_current_age' in values and v <= values['child_current_age']:
            raise ValueError('Education start age must be greater than child current age')
        return v

class ChildMarriageData(FormDataBase):
    child_current_age: int = Field(ge=0, le=30)
    marriage_age: int = Field(ge=21, le=35)
    
    @validator('marriage_age')
    def validate_marriage_age(cls, v, values):
        if 'child_current_age' in values and v <= values['child_current_age']:
            raise ValueError('Marriage age must be greater than child current age')
        return v

class HousePurchaseData(FormDataBase):
    target_purchase_year: int = Field(ge=2025, le=2050)
    
    @validator('target_purchase_year')
    def validate_purchase_year(cls, v):
        current_year = datetime.now().year
        if v <= current_year:
            raise ValueError('Target purchase year must be in the future')
        return v

class GeneralWealthData(FormDataBase):
    override_time_horizon_years: int = Field(ge=1, le=40)

# Union type for all form data
FormData = Union[RetirementData, ChildEducationData, ChildMarriageData, HousePurchaseData, GeneralWealthData]

class SIPCalculationResult(BaseModel):
    time_horizon_years: int
    total_months: int
    monthly_sip_amount: float
    total_investment: float
    expected_returns: float
    risk_adjusted_returns: Dict[str, float]

class FormSubmissionResponse(BaseModel):
    success: bool
    message: str
    calculation_result: Optional[SIPCalculationResult] = None
    form_data: Dict[str, Any]

# Helper functions
# unused
# def get_expected_returns(risk_appetite: str) -> float:
#     """Get expected returns based on risk appetite - can be customized via JSON config"""
#     # Try to get from config first, fall back to defaults
#     if SIP_CONFIG:
#         try:
#             # Look for risk profiles in config
#             for field in SIP_CONFIG["formConfig"]["fields"]["always_required"]:
#                 if field["name"] == "risk_appetite" and "options" in field:
#                     for option in field["options"]:
#                         if option["value"] == risk_appetite:
#                             # Extract return percentage from label if present
#                             label = option["label"]
#                             if "(" in label and "%" in label:
#                                 return_str = label.split("(")[1].split("%")[0]
#                                 try:
#                                     return float(return_str) / 100
#                                 except:
#                                     pass
#         except:
#             pass
    
#     # Default returns mapping
#     returns_map = {
#         "very_low": 0.05,
#         "low": 0.07,
#         "low_moderate": 0.08,
#         "moderate": 0.10,
#         "high_moderate": 0.11,
#         "high": 0.12,
#         "very_high": 0.14
#     }
#     return returns_map.get(risk_appetite, 0.10)

def calculate_time_horizon(form_data: Dict[str, Any]) -> int:
    """Calculate time horizon based on goal type using computed_fields from JSON config"""
    goal_type = form_data.get("goal_type")
    
    # Try to use computed fields from config if available
    if SIP_CONFIG and "computed_fields" in SIP_CONFIG:
        try:
            time_horizon_config = SIP_CONFIG["computed_fields"]["time_horizon_years"]
            if goal_type in time_horizon_config:
                formula = time_horizon_config[goal_type]
                # Simple formula evaluation (this could be enhanced with a proper expression evaluator)
                if goal_type == "Retirement":
                    return form_data.get("retirement_age", 60) - form_data.get("current_age", 30)
                elif goal_type == "Child Education":
                    return form_data.get("education_start_age", 18) - form_data.get("child_current_age", 0)
                elif goal_type == "Child Marriage":
                    return form_data.get("marriage_age", 25) - form_data.get("child_current_age", 0)
                elif goal_type == "House Purchase":
                    return form_data.get("target_purchase_year", datetime.now().year + 5) - datetime.now().year
                elif goal_type == "General Wealth Creation":
                    return form_data.get("override_time_horizon_years", 10)
        except:
            pass
    
    # Fallback logic
    if goal_type == "Retirement":
        return form_data.get("retirement_age", 60) - form_data.get("current_age", 30)
    elif goal_type == "Child Education":
        return form_data.get("education_start_age", 18) - form_data.get("child_current_age", 0)
    elif goal_type == "Child Marriage":
        return form_data.get("marriage_age", 25) - form_data.get("child_current_age", 0)
    elif goal_type == "House Purchase":
        return form_data.get("target_purchase_year", datetime.now().year + 5) - datetime.now().year
    elif goal_type == "General Wealth Creation":
        return form_data.get("override_time_horizon_years", 10)
    
    return 10  # default

# unused
# def calculate_sip_amount(target_amount: float, time_horizon_years: int, annual_return: float) -> float:
#     """Calculate required monthly SIP amount"""
#     if time_horizon_years <= 0:
#         raise ValueError("Time horizon must be positive")
    
#     months = time_horizon_years * 12
#     monthly_return = annual_return / 12
    
#     if monthly_return == 0:
#         return target_amount / months
    
#     # SIP formula: FV = PMT * [((1 + r)^n - 1) / r]
#     # PMT = FV * r / ((1 + r)^n - 1)
#     future_value_factor = ((1 + monthly_return) ** months - 1) / monthly_return
#     monthly_sip = target_amount / future_value_factor
    
#     return monthly_sip

# API Endpoints

@app.get("/")
async def root():
    """Health check endpoint with configuration status"""
    config_status = "loaded" if SIP_CONFIG is not None else "not loaded"
    config_file_path = Path(__file__).parent / "sip_ui_binding.json"
    config_file_exists = config_file_path.exists()
    
    return {
        "message": "SIP Goal Planning API is running", 
        "version": "1.0.0",
        "config_status": config_status,
        "config_file_exists": config_file_exists,
        "config_file_path": str(config_file_path)
    }

@app.post("/api/reload-config")
async def reload_configuration():
    """Reload configuration from JSON file"""
    global SIP_CONFIG
    try:
        SIP_CONFIG = load_sip_config()
        # Recreate enums with new configuration
        create_dynamic_enums()
        return {
            "success": True,
            "message": "Configuration reloaded successfully",
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException as e:
        return {
            "success": False,
            "message": f"Failed to reload configuration: {e.detail}",
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/form-config")
async def get_form_config():
    """Get the complete form configuration for the React UI"""
    if SIP_CONFIG is None:
        # Try to reload configuration
        try:
            config = load_sip_config()
            return config
        except HTTPException:
            raise
    return SIP_CONFIG

@app.get("/api/form-config/{goal_type}")
async def get_conditional_fields(goal_type: str):
    """Get conditional fields for a specific goal type"""
    if SIP_CONFIG is None:
        try:
            config = load_sip_config()
        except HTTPException:
            raise
    else:
        config = SIP_CONFIG
        
    conditional_fields = config["formConfig"]["fields"]["conditional_fields"].get(goal_type, [])
    return {
        "goal_type": goal_type,
        "conditional_fields": conditional_fields
    }

@app.post("/api/validate-form")
async def validate_form_data(form_data: Dict[str, Any] = Body(...)):
    """Validate form data without submitting"""
    try:
        goal_type = form_data.get("goal_type")
        
        # Validate based on goal type
        if goal_type == "Retirement":
            RetirementData(**form_data)
        elif goal_type == "Child Education":
            ChildEducationData(**form_data)
        elif goal_type == "Child Marriage":
            ChildMarriageData(**form_data)
        elif goal_type == "House Purchase":
            HousePurchaseData(**form_data)
        elif goal_type == "General Wealth Creation":
            GeneralWealthData(**form_data)
        else:
            raise ValueError("Invalid goal type")
        
        time_horizon = calculate_time_horizon(form_data)
        
        return {
            "valid": True,
            "message": "Form data is valid",
            "time_horizon_years": time_horizon,
            "total_months": time_horizon * 12
        }
    
    except Exception as e:
        return {
            "valid": False,
            "message": str(e),
            "errors": [str(e)]
        }

def load_orchestrator_template():
    """Load agent config and orchestrator template from file"""    
    # Set template path
    template_path = Path("prompts/orchestrator_agent/SIP_Orchestrator_Prompt_Template_patched_v3.txt")
    
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            orchestrator_template = f.read()
        
        return  orchestrator_template
        
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail=f"Orchestrator template not found: {template_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading orchestrator template: {e}")

def load_and_populate_orchestrator_prompt(form_context: Dict) -> str:
    """
    Loads the orchestrator template and populates it with the given form_context.

    Args:
        form_context (Dict): A dictionary containing the user's goal details.

    Returns:
        str: The populated prompt as a string.
    """
    # Define the path to the directory containing the template file
    template_dir = Path("prompts/orchestrator_agent")

    # Set up the Jinja2 environment
    env = Environment(loader=FileSystemLoader(template_dir))

    # Load the template file
    template_path = "SIP_Orchestrator_Prompt_Template_patched_v4.txt"
    try:
        template = env.get_template(template_path)
    except FileNotFoundError:
        # Create the necessary directory and a dummy file if they don't exist
        # This is for demonstration purposes and assumes the template is not actually available
        template_dir.mkdir(parents=True, exist_ok=True)
        with open(template_dir / template_path, "w") as f:
            f.write("goal_type = {{ goal_type }}")

        # Retry loading the template
        template = env.get_template(template_path)

    # Render the template with the provided form_context
    return template.render(form_context)

import datetime
from typing import Dict, Union

def calculate_time_horizon_years(form_context: Dict) -> Union[int, None]:
    """
    Calculates the time horizon based on the goal type.

    Args:
        form_context (Dict): A dictionary containing all relevant goal data.

    Returns:
        int: The calculated time horizon in years, or None if a required
             variable is missing.
    """
    goal_type = form_context.get("goal_type")

    if goal_type == "Retirement":
        current_age = form_context.get("current_age")
        retirement_age = form_context.get("retirement_age")
        override_time_horizon_years = form_context.get("override_time_horizon_years", 0)

        # Check for required variables
        if current_age is None or retirement_age is None:
            return None
        
        return max(override_time_horizon_years, retirement_age - current_age)

    elif goal_type == "Child Education":
        child_current_age = form_context.get("child_current_age")
        education_start_age = form_context.get("education_start_age")

        if child_current_age is None or education_start_age is None:
            return None
            
        return education_start_age - child_current_age

    elif goal_type == "Child Marriage":
        child_current_age = form_context.get("child_current_age")
        marriage_age = form_context.get("marriage_age")

        if child_current_age is None or marriage_age is None:
            return None
            
        return marriage_age - child_current_age

    elif goal_type == "House Purchase":
        target_purchase_year = form_context.get("target_purchase_year")
        
        if target_purchase_year is None:
            return None
        
        # Assuming you have the current year from the datetime module
        current_year = datetime.date.today().year
        return target_purchase_year - current_year

    else:  # This will handle "General Wealth Creation" and other cases
        return form_context.get("override_time_horizon_years")

# Usage in your endpoint:
# agent_config, orchestrator_template = load_orchestrator_template()
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from agent_stream_service import agent_stream_service, EventType
import time
import asyncio
import traceback

@app.post("/api/calculate-sip")
async def calculate_sip_stream(request: Request, form_data: Dict[str, Any] = Body(...)):
    """Stream SIP calculation progress"""
    
    async def event_generator():
        try:
            # Send initial connection event
            initial_event = {
                "type": "connection_established",
                "data": {"message": "Connection established"},
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(initial_event)}\n\n"
            
            # Generate the prompt
            goal_type = form_data.get("goal_type")
            orchestrator_template = load_orchestrator_template()
            form_data["override_time_horizon_years"] = int(calculate_time_horizon_years(form_data))
            form_data["total_months"] = int(form_data["override_time_horizon_years"]) * 12  
            
            form_context = json.dumps(form_data, indent=2)
            form_context_dict = ast.literal_eval(form_context)
            final_prompt = load_and_populate_orchestrator_prompt(form_context_dict)
            
            # Send prompt generated event
            prompt_event = {
                "type": "prompt_generated",
                "data": {"message": "Prompt generated, starting agent execution..."},
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(prompt_event)}\n\n"
            
            # Stream the agent execution
            try:
                async for event_data in agent_stream_service.process_query_stream(final_prompt):
                    # Check if client disconnected
                    if await request.is_disconnected():
                        print("Client disconnected, stopping stream")
                        break
                        
                    yield event_data
                    
                    # Add small delay to prevent overwhelming the client
                    await asyncio.sleep(0.01)
                    
            except Exception as stream_error:
                print(f"Stream error: {stream_error}")
                traceback.print_exc()
                error_event = {
                    "type": "stream_error", 
                    "data": {"error": str(stream_error)},
                    "timestamp": time.time()
                }
                yield f"data: {json.dumps(error_event)}\n\n"
            
            # Send completion event
            completion_event = {
                "type": "stream_complete",
                "data": {"message": "Stream completed successfully"},
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(completion_event)}\n\n"
                
        except Exception as e:
            print(f"Event generator error: {e}")
            traceback.print_exc()
            error_data = {
                "type": "fatal_error",
                "data": {"error": str(e)},
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(error_data)}\n\n"
        
        finally:
            # Ensure stream always ends properly
            final_event = {
                "type": "stream_end",
                "data": {"message": "Stream ended"},
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(final_event)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",  # 🔥 CHANGED: Use proper SSE media type
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
            "X-Accel-Buffering": "no"  # 🔥 ADDED: Disable nginx buffering
        }
    )
# @app.post("/api/calculate-sip-stream")
# async def calculate_sip_stream(request: Request, form_data: Dict[str, Any] = Body(...)):
#     """Stream SIP calculation progress"""
    
#     async def event_generator():
#         try:
#             # Generate the prompt (same as before)
#             goal_type = form_data.get("goal_type")
#             orchestrator_template = load_orchestrator_template()
#             form_data["override_time_horizon_years"] = int(calculate_time_horizon_years(form_data))
#             form_data["total_months"] = int(form_data["override_time_horizon_years"]) * 12  
            
#             form_context = json.dumps(form_data, indent=2)
#             form_context_dict = ast.literal_eval(form_context)
#             final_prompt = load_and_populate_orchestrator_prompt(form_context_dict)
            
#             # Stream the agent execution
#             async for event_data in agent_stream_service.process_query_stream(final_prompt):
#                 # Check if client disconnected
#                 if await request.is_disconnected():
#                     break
                    
#                 yield event_data
                
#         except Exception as e:
#             error_data = {
#                 "type": EventType.ERROR.value,
#                 "data": {"error": str(e)},
#                 "timestamp": time.time()
#             }
#             yield f"data: {json.dumps(error_data)}\n\n"
    
#     return StreamingResponse(
#         event_generator(),
#         media_type="text/plain",
#         headers={
#             "Cache-Control": "no-cache",
#             "Connection": "keep-alive",
#             "Access-Control-Allow-Origin": "*",
#             "Access-Control-Allow-Headers": "Cache-Control"
#         }
#     )

# @app.post("/api/calculate-sip", response_model=FormSubmissionResponse)
# async def calculate_sip_plan(form_data: Dict[str, Any] = Body(...)):
#     """Calculate SIP plan based on form data"""
#     try:
#         goal_type = form_data.get("goal_type")
#         # Calculate parameters        
#         orchestrator_template = load_orchestrator_template()
#         form_data["override_time_horizon_years"] = int(calculate_time_horizon_years(form_data))
#         form_data["total_months"] = int(form_data["override_time_horizon_years"]) * 12  
                
#         try:
#             form_context = json.dumps(form_data, indent=2)
#             form_context_dict = ast.literal_eval(form_context)
#             final_prompt = load_and_populate_orchestrator_prompt(form_context_dict)
#             print(final_prompt)
#         except Exception as e:
#             print(f"An error occurred: {e}")
        
#         calculation_result = ""
#         return FormSubmissionResponse(
#             success=True,
#             message="SIP calculation completed successfully",
#             calculation_result=calculation_result,
#             form_data=form_data
#         )    
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/sample-data")
async def get_sample_data():
    """Get sample form data for testing"""
    if SIP_CONFIG is None:
        try:
            config = load_sip_config()
        except HTTPException:
            raise
    else:
        config = SIP_CONFIG
    
    # Get sample data from config, or return default if not present
    sample_data = config.get("sample_data", {
        "retirement_example": {
            "goal_type": "Retirement",
            "current_age": 30,
            "retirement_age": 60,
            "currency": "INR",
            "target_amount_min": 10000000,
            "risk_appetite": "moderate"
        },
        "child_education_example": {
            "goal_type": "Child Education",
            "current_age": 35,
            "child_current_age": 5,
            "education_start_age": 18,
            "currency": "INR",
            "target_amount_min": 2500000,
            "risk_appetite": "high_moderate"
        }
    })
    
    return sample_data

@app.get("/api/risk-profiles")
async def get_risk_profiles():
    """Get detailed risk profile information from config or defaults"""
    if SIP_CONFIG:
        try:
            # Try to extract risk profiles from configuration
            for field in SIP_CONFIG["formConfig"]["fields"]["always_required"]:
                if field["name"] == "risk_appetite" and "options" in field:
                    risk_profiles = []
                    for i, option in enumerate(field["options"]):
                        # Extract return percentage from label
                        return_pct = "N/A"
                        description = option["label"]
                        if "(" in option["label"] and "%" in option["label"]:
                            return_pct = option["label"].split("(")[1].split(")")[0]
                            description = option["label"].split(" (")[0]
                        
                        risk_profiles.append({
                            "value": option["value"],
                            "label": description,
                            "expected_return": return_pct,
                            "description": description,
                            "risk_level": i + 1
                        })
                    return {"risk_profiles": risk_profiles}
        except:
            pass
    
    

if __name__ == "__main__":
    import uvicorn
    
    # Check configuration status before starting server
    config_file = Path(__file__).parent / "sip_ui_binding.json"
    
    print("🚀 Starting SIP Goal Planning API...")
    print(f"📄 Looking for config file: {config_file}")
    
    if not config_file.exists():
        print("❌ WARNING: sip_ui_binding.json not found!")
        print("📝 Please create the file with your SIP configuration")
        print("🔄 You can use the /api/reload-config endpoint to reload after creating the file")
    elif SIP_CONFIG is None:
        print("⚠️  WARNING: Configuration file exists but failed to load")
        print("🔍 Please check the JSON syntax in sip_ui_binding.json")
    else:
        print("✅ Configuration loaded successfully")
        form_config = SIP_CONFIG.get("formConfig", {})
        print(f"📋 Form title: {form_config.get('title', 'N/A')}")
        conditional_fields = form_config.get("fields", {}).get("conditional_fields", {})
        print(f"🎯 Goal types configured: {list(conditional_fields.keys())}")
    
    print("\n🌐 Starting server on http://localhost:8000")
    print("📖 API Documentation: http://localhost:8000/docs")
    print("🔄 Reload config: POST http://localhost:8000/api/reload-config")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)