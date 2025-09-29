from fastapi import FastAPI, HTTPException, Body, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, validator
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
import json
import os
import sys
import glob
import re
from pathlib import Path
from enum import Enum
from jinja2 import Environment, FileSystemLoader
import ast
import time
import asyncio
import traceback
import logging
from contextlib import asynccontextmanager

# Add the parent directory to Python path
parent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(parent_dir))

from contextlib import asynccontextmanager
from agentLoop.model_manager import ModelManager  # Your existing ModelManager

# Import the fixed agent service
from agent_stream_service import agent_stream_service, EventType

# Initialize ModelManager for fund recommendation template processing
try:
    model_manager = ModelManager()  # Uses default model from profile
    print("✅ ModelManager initialized for fund recommendation processing")
except Exception as e:
    print(f"⚠️ Warning: ModelManager initialization failed: {e}")
    model_manager = None

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

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173","https://sifura.azurewebsites.net"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]  # Added for file serving
)

# Mount static files directory for media files
media_dir = Path("media")
if media_dir.exists():
    app.mount("/media", StaticFiles(directory="media"), name="media")
    print(f"📁 Mounted static media directory: {media_dir}")

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
        print("📄 Please ensure 'sip_ui_binding.json' is in the same directory as this script")
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
    print(f"⚠️ Warning: Could not load configuration at startup: {e}")
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

# Enhanced helper functions for file operations and session management
def extract_session_id_from_path(file_path: str) -> Optional[str]:
    """Extract session ID from file path following pattern: media/generated/{SESSION_ID}/filename.html"""
    try:
        # Handle both Windows and Unix path separators
        normalized_path = file_path.replace('\\', '/')
        
        # Look for pattern: media/generated/{SESSION_ID}/
        pattern = r'media[/\\]generated[/\\]([^/\\]+)[/\\]'
        match = re.search(pattern, normalized_path)
        
        if match:
            session_id = match.group(1)
            print(f"✅ Extracted session ID: {session_id} from path: {file_path}")
            return session_id
        else:
            print(f"⚠️ Could not extract session ID from path: {file_path}")
            return None
    except Exception as e:
        print(f"❌ Error extracting session ID: {e}")
        return None

def construct_standard_file_path(session_id: str, filename: str) -> str:
    """Construct standardized file path using session ID"""
    return f"media/generated/{session_id}/{filename}"

def find_latest_report_file_by_session(session_id: str = None) -> Optional[tuple]:
    """Find the most recently generated HTML report, optionally filtered by session ID"""
    try:
        if session_id:
            # Look for specific session files first
            session_pattern = f"media/generated/{session_id}/comprehensive_report.html"
            session_files = glob.glob(session_pattern)
            if session_files:
                latest_file = max(session_files, key=os.path.getmtime)
                filename = os.path.basename(latest_file)
                return filename, latest_file
        
        # Fallback to general search
        media_pattern = "media/generated/*/comprehensive_report.html"
        html_files = glob.glob(media_pattern)
        
        if not html_files:
            # Also try without media prefix in case of different structure
            alt_pattern = "*/comprehensive_report.html"
            html_files = glob.glob(alt_pattern)
        
        if not html_files:
            return None
        
        # Get the most recently modified file
        latest_file = max(html_files, key=os.path.getmtime)
        filename = os.path.basename(latest_file)
        
        return filename, latest_file
    except Exception as e:
        print(f"Error finding report file: {e}")
        return None

def find_latest_fund_recommendation_file_by_session(session_id: str = None) -> Optional[tuple]:
    """Find the most recently generated fund recommendation HTML report"""
    try:
        patterns = []
        
        if session_id:
            # Look for specific session files first with multiple possible names
            patterns.extend([
                f"media/generated/{session_id}/fund_recommendation_report.html",
                f"media/generated/{session_id}/fund_recommendations.html",
                f"media/generated/{session_id}/fund_recommendation*.html",
                f"media/generated/{session_id}/*fund*.html",
                f"media/generated/{session_id}/*recommendation*.html"
            ])
        
        # General patterns
        patterns.extend([
            "media/generated/*/fund_recommendation_report.html",
            "media/generated/*/fund_recommendations.html", 
            "media/generated/*/*fund*.html",
            "media/generated/*/*recommendation*.html",
            "*/fund_recommendation*.html"
        ])
        
        html_files = []
        for pattern in patterns:
            html_files.extend(glob.glob(pattern))
        
        # Remove duplicates while preserving order
        html_files = list(dict.fromkeys(html_files))
        
        if not html_files:
            return None
        
        # Get the most recently modified file
        latest_file = max(html_files, key=os.path.getmtime)
        filename = os.path.basename(latest_file)
        
        print(f"📄 Found fund recommendation file: {latest_file}")
        return filename, latest_file
    except Exception as e:
        print(f"Error finding fund recommendation file: {e}")
        return None

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

def load_orchestrator_template():
    """Load agent config and orchestrator template from file"""    
    # Set template path
    template_path = Path("prompts/orchestrator_agent/SIP_Orchestrator_Prompt_Template_patched_v3.txt")
    
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            orchestrator_template = f.read()
        
        return orchestrator_template
        
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
        
        # FIXED: Use datetime.now().year instead of datetime.date.today().year
        current_year = datetime.now().year
        return target_purchase_year - current_year

    else:  # This will handle "General Wealth Creation" and other cases
        return form_context.get("override_time_horizon_years")

# Fund Recommendation Helper Functions
def read_html_report_content(file_path: str) -> str:
    """Read the HTML report file as raw content for model processing"""
    try:
        if not Path(file_path).exists():
            raise FileNotFoundError(f"Report file not found: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        print(f"✅ Successfully read HTML report file: {file_path}")
        return html_content
        
    except Exception as e:
        print(f"❌ Error reading HTML report: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading HTML report: {str(e)}")

async def process_html_and_populate_template(html_content: str, template: str) -> str:
    """Use ModelManager to read HTML report and populate fund recommendation template - mimicking ChatGPT workflow"""
    try:
        if model_manager is None:
            print("⚠️ ModelManager not available, falling back to manual population")
            return populate_template_manually_from_html(template, html_content)
        
        # Create a comprehensive prompt that mimics uploading HTML file to ChatGPT
        model_prompt = f"""
I am providing you with an HTML report file (comprehensive_report.html) from a SIP investment calculation and a fund recommendation template that needs to be populated.

Please analyze the HTML report and extract the relevant investment data, then populate ALL placeholders in the template.

HTML REPORT CONTENT:
{html_content}

FUND RECOMMENDATION TEMPLATE TO POPULATE:
{template}

INSTRUCTIONS:
1. Analyze the HTML report content to extract investment data (goal type, amounts, time horizon, risk appetite, etc.)
2. Replace ALL placeholders in the template (marked with {{{{ }}}}) with appropriate values extracted from the HTML report
3. For any placeholders not directly available in the HTML, use reasonable defaults based on the investment context
4. Maintain the exact structure and formatting of the template
5. Calculate derived values like asset allocation percentages based on risk appetite
6. Set appropriate risk profile weights for the fund recommendation
7. Provide goal-specific phase descriptions and recommendations

Return ONLY the populated template with all placeholders replaced:
"""
        
        # Generate content using ModelManager - this mimics what you did with ChatGPT
        populated_template = await model_manager.generate_text(model_prompt)
        
        print(f"✅ Template populated successfully using ModelManager (ChatGPT-style processing)")
        return populated_template
        
    except Exception as e:
        print(f"❌ Error processing HTML and populating template with ModelManager: {e}")
        # Fallback to manual population
        return populate_template_manually_from_html(template, html_content)

def populate_template_manually_from_html(template: str, html_content: str) -> str:
    """Fallback: Extract basic data from HTML using regex and populate template manually"""
    try:
        import re
        
        # Extract data using simple regex patterns (basic fallback)
        goal_type_match = re.search(r'Goal Type:</strong>\s*([^<]+)', html_content)
        goal_type = goal_type_match.group(1).strip() if goal_type_match else 'General Wealth Creation'
        
        target_amount_match = re.search(r'Target Amount:</strong>[^₹]*₹\s*([\d,]+)', html_content)
        target_amount = target_amount_match.group(1).replace(',', '') if target_amount_match else '5000000'
        
        time_horizon_match = re.search(r'Time Horizon:</strong>\s*(\d+)\s*years', html_content)
        time_horizon = time_horizon_match.group(1) if time_horizon_match else '10'
        
        risk_match = re.search(r'Risk Level:</strong>\s*([^<]+)', html_content)
        risk_appetite = risk_match.group(1).strip().lower() if risk_match else 'moderate'
        
        monthly_sip_match = re.search(r'Monthly SIP Amount[^₹]*₹\s*([\d,]+)', html_content)
        monthly_sip = monthly_sip_match.group(1).replace(',', '') if monthly_sip_match else '25000'
        
        # Basic placeholder replacements
        replacements = {
            '{{GOAL_TYPE}}': goal_type.upper(),
            '{{TIME_HORIZON}}': time_horizon,
            '{{goal_type}}': goal_type,
            '{{current_age}}': '30',  # Default
            '{{event_age_or_target}}': str(int(time_horizon) + 30),
            '{{risk_appetite}}': risk_appetite,
            '{{time_horizon_years}}': time_horizon,
            '{{monthly_sip_required}}': monthly_sip,
            '{{target_amount_inflation_adjusted}}': target_amount,
            '{{assumed_annual_return}}': '10.0',
            '{{unadjusted_target}}': target_amount,
            '{{inflation_rate}}': '6.0',
            '{{equity_percent}}': '60',
            '{{debt_percent}}': '40',
            '{{allocation_strategy}}': '60-40 Strategy',
            '{{total_monthly_amount}}': monthly_sip,
            '{{equity_monthly_amount}}': str(int(int(monthly_sip) * 0.6)),
            '{{debt_monthly_amount}}': str(int(int(monthly_sip) * 0.4)),
            '{{weight_cagr}}': '0.3',
            '{{weight_sharpe}}': '0.25',
            '{{weight_expense}}': '0.15',
            '{{weight_rating}}': '0.15',
            '{{weight_consistency}}': '0.1',
            '{{weight_liquidity_or_downside}}': '0.05',
            '{{early_phase_focus}}': 'Growth and accumulation',
            '{{mid_phase_focus}}': 'Balanced growth and risk management',
            '{{final_phase_focus}}': 'Capital preservation and liquidity',
            '{{goal_specific_notes}}': f'Optimized for {goal_type} with {time_horizon}-year horizon'
        }
        
        populated_template = template
        for placeholder, value in replacements.items():
            populated_template = populated_template.replace(placeholder, value)
        
        print(f"✅ Template populated manually as fallback")
        return populated_template
        
    except Exception as e:
        print(f"❌ Error in manual template population from HTML: {e}")
        raise HTTPException(status_code=500, detail=f"Error populating template: {str(e)}")

def load_fund_recommendation_template() -> str:
    """Load fund recommendation orchestrator template"""
    template_path = Path("prompts/orchestrator_agent/Fund_Recommendation_Orchestrator_Prompt_Template_v1.txt")
    
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()
        return template_content
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail=f"Fund recommendation template not found: {template_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading fund recommendation template: {e}")

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
        "config_file_path": str(config_file_path),
        "model_manager_available": model_manager is not None
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

# Enhanced streaming endpoint with better file detection and path normalization
@app.post("/api/calculate-sip")
async def calculate_sip_stream(request: Request, form_data: Dict[str, Any] = Body(...)):
    """Stream SIP calculation progress with enhanced HTML report detection and path handling"""
    
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
            
            # Track generated file information
            generated_file_path = None
            generated_filename = None
            session_id = None
            
            # Stream the agent execution
            try:
                async for event_data in agent_stream_service.process_query_stream(final_prompt):
                    # Check if client disconnected
                    if await request.is_disconnected():
                        print("Client disconnected, stopping stream")
                        break
                    
                    # Parse the event to check for file generation
                    try:
                        # Remove 'data: ' prefix if present
                        clean_data = event_data.replace("data: ", "").strip()
                        if clean_data:
                            event_json = json.loads(clean_data)
                            
                            # Check if this is a file generation event from the agent
                            if (event_json.get("type") == "agent_response" and 
                                "comprehensive_report.html" in str(event_json.get("data", {}).get("message", ""))):
                                
                                # Extract file path from agent response
                                message = event_json["data"]["message"]
                                print(f"Detected file generation in message: {message}")
                                
                                # Enhanced: Look for file path patterns with session ID extraction
                                path_patterns = [
                                    r'media[\\\/]generated[\\\/]([^\\\/]+)[\\\/]comprehensive_report\.html',
                                    r'([^\\\/]+[\\\/])*media[\\\/]generated[\\\/]([^\\\/]+)[\\\/]comprehensive_report\.html',
                                    r'[\w\\/.-]+comprehensive_report\.html'
                                ]
                                
                                for pattern in path_patterns:
                                    path_match = re.search(pattern, message)
                                    if path_match:
                                        generated_file_path = path_match.group(0)
                                        generated_filename = "comprehensive_report.html"
                                        
                                        # Extract session ID
                                        session_id = extract_session_id_from_path(generated_file_path)
                                        
                                        # Normalize path for consistency
                                        if session_id:
                                            normalized_path = construct_standard_file_path(session_id, "comprehensive_report.html")
                                            print(f"📁 Normalized path: {normalized_path}")
                                        else:
                                            normalized_path = generated_file_path
                                        
                                        # Emit file generated event with both original and normalized paths
                                        file_event = {
                                            "type": "file_generated",
                                            "data": {
                                                "filename": generated_filename,
                                                "filepath": generated_file_path,
                                                "normalized_path": normalized_path,
                                                "session_id": session_id
                                            },
                                            "timestamp": time.time()
                                        }
                                        yield f"data: {json.dumps(file_event)}\n\n"
                                        print(f"📄 Emitted file_generated event for: {generated_file_path}")
                                        break
                    except json.JSONDecodeError:
                        pass  # Continue with normal event streaming
                    except Exception as parse_error:
                        print(f"Error parsing stream event: {parse_error}")
                        pass  # Continue with normal event streaming
                    
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
            
            # If no file was detected during streaming, try to find it
            if not generated_file_path:
                print("No file detected during streaming, searching for generated reports...")
                
                # Look for recently generated files, preferably with session ID
                found_file = find_latest_report_file_by_session(session_id)
                if found_file:
                    generated_filename, generated_file_path = found_file
                    
                    # Extract session ID if not already available
                    if not session_id:
                        session_id = extract_session_id_from_path(generated_file_path)
                    
                    # Emit file generated event
                    file_event = {
                        "type": "file_generated",
                        "data": {
                            "filename": generated_filename,
                            "filepath": generated_file_path,
                            "session_id": session_id
                        },
                        "timestamp": time.time()
                    }
                    yield f"data: {json.dumps(file_event)}\n\n"
                    print(f"📄 Found and emitted file_generated event for: {generated_file_path}")
                else:
                    print("⚠️ No HTML report file found")
            
            # Send completion event
            completion_event = {
                "type": "stream_complete",
                "data": {
                    "message": "Stream completed successfully",
                    "generated_file_path": generated_file_path,
                    "session_id": session_id
                },
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
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
            "X-Accel-Buffering": "no"
        }
    )

# Replace the incomplete fund recommendation endpoint with this fixed version:

@app.post("/api/fund-recommendation")
async def fund_recommendation_stream(request: Request, fund_request: Dict[str, Any] = Body(...)):
    """Stream fund recommendation with session-aware file detection"""
    
    async def event_generator():
        try:
            # Extract SIP session info for comparison
            sip_report_path = fund_request.get("report_file_path")
            sip_session_id = extract_session_id_from_path(sip_report_path)
            
            if not sip_session_id:
                raise ValueError("Could not extract SIP session ID from report path")
            
            print(f"SIP Session ID for comparison: {sip_session_id}")
            
            # Send initial connection event
            initial_event = {
                "type": "connection_established",
                "data": {
                    "message": "Fund recommendation connection established",
                    "sip_session_reference": sip_session_id
                },
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(initial_event)}\n\n"
            
            # FIXED: Add the missing template processing code
            try:
                # Load fund recommendation template
                fund_template = load_fund_recommendation_template()
                
                # Read the HTML report content
                html_content = read_html_report_content(sip_report_path)
                
                # Process HTML and populate template
                populated_template = await process_html_and_populate_template(html_content, fund_template)
                
                print("✅ Fund recommendation template populated successfully")
                
            except Exception as template_error:
                print(f"❌ Template processing error: {template_error}")
                error_event = {
                    "type": "stream_error",
                    "data": {"error": f"Template processing failed: {str(template_error)}"},
                    "timestamp": time.time()
                }
                yield f"data: {json.dumps(error_event)}\n\n"
                return
            
            # Track fund file generation
            generated_fund_file_path = None
            generated_fund_filename = None
            fund_session_id = None
            
            # Stream the agent execution with enhanced detection
            try:
                async for event_data in agent_stream_service.process_query_stream(populated_template):
                    if await request.is_disconnected():
                        break
                    
                    # Enhanced fund file detection
                    try:
                        clean_data = event_data.replace("data: ", "").strip()
                        if clean_data:
                            event_json = json.loads(clean_data)
                            
                            if event_json.get("type") == "agent_response":
                                message = event_json.get("data", {}).get("message", "")
                                
                                # Use session-aware detection
                                fund_file_event = detect_fund_file_with_session_awareness(message, sip_session_id)
                                if fund_file_event:
                                    # Store fund file info
                                    fund_data = fund_file_event["data"]
                                    generated_fund_file_path = fund_data["filepath"]
                                    generated_fund_filename = fund_data["filename"]
                                    fund_session_id = fund_data["session_id"]
                                    
                                    print(f"Fund file detected: {generated_fund_file_path} (Session: {fund_session_id})")
                                    yield f"data: {json.dumps(fund_file_event)}\n\n"
                                    continue
                                    
                    except json.JSONDecodeError:
                        pass
                    except Exception as parse_error:
                        print(f"Error in fund file detection: {parse_error}")
                    
                    yield event_data
                    await asyncio.sleep(0.01)
                    
            except Exception as stream_error:
                print(f"Fund recommendation stream error: {stream_error}")
                error_event = {
                    "type": "stream_error",
                    "data": {"error": str(stream_error)},
                    "timestamp": time.time()
                }
                yield f"data: {json.dumps(error_event)}\n\n"
            
            # Enhanced fallback search with session awareness
            if not generated_fund_file_path:
                print("Searching for fund recommendation files using session awareness...")
                fallback_fund_info = find_fund_file_different_from_sip_session(sip_session_id)
                if fallback_fund_info:
                    generated_fund_file_path = fallback_fund_info["filepath"]
                    generated_fund_filename = fallback_fund_info["filename"]
                    fund_session_id = fallback_fund_info["session_id"]
                    
                    fallback_event = {
                        "type": "file_generated",
                        "data": {
                            "filename": generated_fund_filename,
                            "filepath": generated_fund_file_path,
                            "session_id": fund_session_id,
                            "original_sip_session": sip_session_id,
                            "file_type": "fund_recommendation",
                            "detection_method": "fallback_search"
                        },
                        "timestamp": time.time()
                    }
                    yield f"data: {json.dumps(fallback_event)}\n\n"
            
            # Send completion event with session info
            completion_event = {
                "type": "stream_complete",
                "data": {
                    "message": "Fund recommendation completed successfully",
                    "result": {
                        "status": "completed",
                        "sip_report_path": sip_report_path,
                        "sip_session_id": sip_session_id,
                        "fund_report_path": generated_fund_file_path,
                        "fund_session_id": fund_session_id,
                        "session_comparison": "different_sessions" if fund_session_id != sip_session_id else "same_session"
                    }
                },
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(completion_event)}\n\n"
                
        except Exception as e:
            print(f"Fund recommendation event generator error: {e}")
            error_data = {
                "type": "fatal_error",
                "data": {"error": str(e)},
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(error_data)}\n\n"
        
        finally:
            final_event = {
                "type": "stream_end", 
                "data": {"message": "Fund recommendation stream ended"},
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(final_event)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive", 
            "Access-Control-Allow-Origin": "*",
            "X-Accel-Buffering": "no"
        }
    )

# Enhanced HTML Report Serving with better error handling and fund recommendation support
def detect_fund_file_with_session_awareness(message: str, sip_session_id: str) -> Optional[Dict[str, Any]]:
    """
    Detect fund recommendation file generation with session awareness.
    
    Args:
        message: Agent response message
        sip_session_id: Original SIP session ID
        
    Returns:
        Event data dict if fund file detected from different session
    """
    try:
        if "comprehensive_report.html" not in message:
            return None
            
        fund_info = compare_sessions_and_extract_fund_path(message, sip_session_id)
        if not fund_info:
            return None
            
        return {
            "type": "file_generated",
            "data": {
                "filename": fund_info["filename"],
                "filepath": fund_info["filepath"], 
                "session_id": fund_info["session_id"],
                "original_sip_session": sip_session_id,
                "file_type": "fund_recommendation",
                "detection_method": "session_aware"
            },
            "timestamp": time.time()
        }
        
    except Exception as e:
        print(f"Error detecting fund file: {e}")
        return None
def compare_sessions_and_extract_fund_path(message: str, sip_session_id: str) -> Optional[Dict[str, str]]:
    """
    Extract fund recommendation file path and verify it's from a different session than SIP.
    
    Args:
        message: Agent response message containing file path
        sip_session_id: Original SIP session ID for comparison
        
    Returns:
        Dict with fund file info if from different session, None otherwise
    """
    try:
        # Look for comprehensive_report.html in message
        path_patterns = [
            r'media[\\\/]generated[\\\/]([^\\\/]+)[\\\/]comprehensive_report\.html',
            r'([^\\\/\s]+)[\\\/]comprehensive_report\.html'
        ]
        
        for pattern in path_patterns:
            match = re.search(pattern, message)
            if match:
                if len(match.groups()) >= 1:
                    fund_session_id = match.group(1)
                    fund_file_path = f"media/generated/{fund_session_id}/comprehensive_report.html"
                else:
                    fund_file_path = match.group(0)
                    fund_session_id = extract_session_id_from_path(fund_file_path)
                
                # Only return if this is a DIFFERENT session than SIP
                if fund_session_id and fund_session_id != sip_session_id:
                    return {
                        "session_id": fund_session_id,
                        "filepath": fund_file_path,
                        "filename": "comprehensive_report.html"
                    }
        
        return None
        
    except Exception as e:
        print(f"Error comparing sessions: {e}")
        return None
@app.get("/api/download-report", response_class=HTMLResponse)
async def download_report(filepath: str = Query(..., description="File path to the HTML report")):
    """Serve generated HTML reports with enhanced error handling and support for both SIP and fund recommendation reports"""
    try:
        # Convert to Path object and normalize
        file_path = Path(filepath)
        
        # Security check: ensure file is HTML
        if not str(file_path).endswith('.html'):
            raise HTTPException(status_code=400, detail="Only HTML files are allowed")
        
        # Try multiple path resolution strategies
        possible_paths = [
            file_path,  # Original path
            Path(str(file_path).replace('\\', '/')),  # Unix-style path
            Path(str(file_path).replace('/', '\\')),  # Windows-style path
        ]
        
        # Add relative path variations
        if not file_path.is_absolute():
            possible_paths.extend([
                Path.cwd() / file_path,
                Path(__file__).parent / file_path
            ])
        
        resolved_path = None
        for path_option in possible_paths:
            if path_option.exists():
                resolved_path = path_option
                break
        
        if not resolved_path:
            # Log available files for debugging
            print(f"❌ File not found: {filepath}")
            print(f"Tried paths: {[str(p) for p in possible_paths]}")
            
            # List available files in media/generated for debugging
            media_generated = Path("media/generated")
            if media_generated.exists():
                print("Available files in media/generated:")
                for file in media_generated.rglob("*.html"):
                    print(f"  - {file}")
            
            raise HTTPException(status_code=404, detail=f"Report file not found: {filepath}")
        
        # Read and return the HTML content
        with open(resolved_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        print(f"📄 Served HTML report: {resolved_path}")
        return HTMLResponse(content=html_content, status_code=200)
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Report file not found")
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied accessing report file")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Unable to decode HTML file - invalid encoding")
    except Exception as e:
        print(f"Error serving HTML report: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading report file: {str(e)}")

@app.get("/api/reports/{filename}")
async def get_report_by_filename(filename: str):
    """Alternative endpoint to get report by filename (searches in media directory) - supports both SIP and fund reports"""
    try:
        # Security check: ensure filename is HTML
        if not filename.endswith('.html'):
            raise HTTPException(status_code=400, detail="Only HTML files are allowed")
        
        # Look in the media/generated directory
        media_dir = Path("media/generated")
        
        if not media_dir.exists():
            raise HTTPException(status_code=404, detail="Media directory not found")
        
        # Search for the file in subdirectories
        for report_dir in media_dir.rglob("*"):
            if report_dir.is_dir():
                report_file = report_dir / filename
                if report_file.exists():
                    with open(report_file, 'r', encoding='utf-8') as f:
                        html_content = f.read()
                    
                    print(f"📄 Served HTML report by filename: {filename}")
                    return HTMLResponse(content=html_content, status_code=200)
        
        raise HTTPException(status_code=404, detail=f"Report file {filename} not found")
        
    except Exception as e:
        print(f"Error serving HTML report by filename: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading report: {str(e)}")

# Enhanced utility endpoints with session awareness
@app.get("/api/check-reports")
async def check_reports(session_id: str = Query(None, description="Session ID to filter reports")):
    """Check for available generated reports, optionally filtered by session ID"""
    try:
        found_file = find_latest_report_file_by_session(session_id)
        if found_file:
            filename, filepath = found_file
            extracted_session_id = extract_session_id_from_path(filepath)
            return {
                "found": True,
                "filename": filename,
                "filepath": filepath,
                "session_id": extracted_session_id,
                "timestamp": os.path.getmtime(filepath)
            }
        else:
            return {
                "found": False,
                "message": f"No reports found{' for session ' + session_id if session_id else ''}"
            }
    except Exception as e:
        return {
            "found": False,
            "error": str(e)
        }

@app.get("/api/check-fund-reports")
async def check_fund_reports(session_id: str = Query(None, description="Session ID to filter fund reports")):
    """Check for available generated fund recommendation reports, optionally filtered by session ID"""
    try:
        found_file = find_latest_fund_recommendation_file_by_session(session_id)
        if found_file:
            filename, filepath = found_file
            extracted_session_id = extract_session_id_from_path(filepath)
            return {
                "found": True,
                "filename": filename,
                "filepath": filepath,
                "session_id": extracted_session_id,
                "timestamp": os.path.getmtime(filepath)
            }
        else:
            return {
                "found": False,
                "message": f"No fund recommendation reports found{' for session ' + session_id if session_id else ''}"
            }
    except Exception as e:
        return {
            "found": False,
            "error": str(e)
        }

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

@app.post("/api/terminate-process")
async def terminate_process(termination_request: Dict[str, Any] = Body(...)):
    """Terminate running processes"""
    try:
        process_type = termination_request.get("type")
        print(f"🛑 Termination requested for: {process_type}")
        
        # Stop the agent stream service if running
        if hasattr(agent_stream_service, 'abort_current_process'):
            await agent_stream_service.abort_current_process()
        
        return {
            "success": True,
            "message": f"Termination request processed for {process_type}",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Termination failed: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }
    
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

    # Default risk profiles if config doesn't have them
    return {
        "risk_profiles": [
            {
                "value": "very_low",
                "label": "Very Low Risk",
                "expected_return": "5%",
                "description": "Conservative investment approach",
                "risk_level": 1
            },
            {
                "value": "low",
                "label": "Low Risk", 
                "expected_return": "7%",
                "description": "Low risk with stable returns",
                "risk_level": 2
            },
            {
                "value": "moderate",
                "label": "Moderate Risk",
                "expected_return": "10%",
                "description": "Balanced risk and return",
                "risk_level": 3
            },
            {
                "value": "high",
                "label": "High Risk",
                "expected_return": "12%",
                "description": "Higher risk for better returns",
                "risk_level": 4
            },
            {
                "value": "very_high",
                "label": "Very High Risk",
                "expected_return": "15%",
                "description": "Aggressive investment strategy",
                "risk_level": 5
            }
        ]
    }


def find_fund_file_different_from_sip_session(sip_session_id: str) -> Optional[Dict[str, str]]:
    """
    Find comprehensive_report.html files from sessions different than the SIP session.
    
    Args:
        sip_session_id: The original SIP session ID to exclude
        
    Returns:
        Dict with fund file info if found from different session
    """
    try:
        pattern = "media/generated/*/comprehensive_report.html"
        all_reports = glob.glob(pattern)
        
        for report_path in all_reports:
            session_id = extract_session_id_from_path(report_path)
            if session_id and session_id != sip_session_id:
                # This is from a different session - likely the fund recommendation
                return {
                    "filepath": report_path,
                    "filename": "comprehensive_report.html", 
                    "session_id": session_id
                }
        
        return None
        
    except Exception as e:
        print(f"Error in fallback fund search: {e}")
        return None

if __name__ == "__main__":
    import uvicorn
    
    # Check configuration status before starting server
    config_file = Path(__file__).parent / "sip_ui_binding.json"
    
    print("🚀 Starting SIP Goal Planning API...")
    print(f"📄 Looking for config file: {config_file}")
    
    if not config_file.exists():
        print("❌ WARNING: sip_ui_binding.json not found!")
        print("📄 Please create the file with your SIP configuration")
        print("📄 You can use the /api/reload-config endpoint to reload after creating the file")
    elif SIP_CONFIG is None:
        print("⚠️ WARNING: Configuration file exists but failed to load")
        print("📄 Please check the JSON syntax in sip_ui_binding.json")
    else:
        print("✅ Configuration loaded successfully")
        form_config = SIP_CONFIG.get("formConfig", {})
        print(f"📋 Form title: {form_config.get('title', 'N/A')}")
        conditional_fields = form_config.get("fields", {}).get("conditional_fields", {})
        print(f"🎯 Goal types configured: {list(conditional_fields.keys())}")
    
    # Check ModelManager status
    if model_manager is not None:
        print("✅ ModelManager initialized - Fund recommendations available")
    else:
        print("⚠️ ModelManager not available - Fund recommendations will use fallback")
    
    print("\n🌐 Starting server on http://localhost:8000")
    print("📖 API Documentation: http://localhost:8000/docs")
    print("📄 Reload config: POST http://localhost:8000/api/reload-config")
    print("📄 HTML Reports: GET http://localhost:8000/api/download-report?filepath=<path>")
    print("📁 Static Media: http://localhost:8000/media/")
    print("💰 Fund Recommendation: POST http://localhost:8000/api/fund-recommendation")
    print("📊 Check SIP Reports: GET http://localhost:8000/api/check-reports")
    print("📈 Check Fund Reports: GET http://localhost:8000/api/check-fund-reports")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)