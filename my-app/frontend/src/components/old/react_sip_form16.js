import React, { useState, useEffect, useRef } from 'react';

const API_BASE_URL = 'http://localhost:8000/api';

const SIPGoalPlanningForm = () => {
  // State management
  const [formConfig, setFormConfig] = useState(null);
  const [formData, setFormData] = useState({
    currency: 'INR'
  });
  const [conditionalFields, setConditionalFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [validationResult, setValidationResult] = useState(null);
  const [calculationResult, setCalculationResult] = useState(null);
  const [currentStep, setCurrentStep] = useState('form'); // 'form', 'validation', 'streaming', 'results', 'fund_recommendation', 'fund_recommendation_result'
  
  // Streaming states
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamLogs, setStreamLogs] = useState([]);
  const [generatedFileName, setGeneratedFileName] = useState('');
  const [generatedFilePath, setGeneratedFilePath] = useState('');
  const [htmlReportContent, setHtmlReportContent] = useState('');
  const [streamingProgress, setStreamingProgress] = useState(0);
  const [currentAgent, setCurrentAgent] = useState('');
  
  // Fund recommendation state
  const [reportPathForRecommendation, setReportPathForRecommendation] = useState('');
  const [fundRecommendationLogs, setFundRecommendationLogs] = useState([]);
  const [fundRecommendationProgress, setFundRecommendationProgress] = useState(0);
  const [isFundRecommendationStreaming, setIsFundRecommendationStreaming] = useState(false);
  const [fundCurrentAgent, setFundCurrentAgent] = useState('');
  const [fundRecommendationResult, setFundRecommendationResult] = useState(null);
  
  // Fund recommendation result states
  const [fundRecommendationFileName, setFundRecommendationFileName] = useState('');
  const [fundRecommendationFilePath, setFundRecommendationFilePath] = useState('');
  const [fundRecommendationHtmlContent, setFundRecommendationHtmlContent] = useState('');
  
  // Completion tracking states
  const [sipGoalCompleted, setSipGoalCompleted] = useState(false);
  const [fundRecommendationCompleted, setFundRecommendationCompleted] = useState(false);
  const [sipGoalError, setSipGoalError] = useState(false);
  const [fundRecommendationError, setFundRecommendationError] = useState(false);
  
  const eventSourceRef = useRef(null);
  const logsEndRef = useRef(null);
  const fundLogsEndRef = useRef(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamLogs]);

  // Auto-scroll fund recommendation logs to bottom
  useEffect(() => {
    fundLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [fundRecommendationLogs]);

  // Load initial configuration and preserve in session
  useEffect(() => {
    const loadInitialConfig = async () => {
      try {
        // Try to fetch from API first, fall back to mock data if it fails
        try {
          const response = await fetch(`${API_BASE_URL}/form-config`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setFormConfig(data.formConfig);
          console.log('Loaded configuration from API');
        } catch (apiError) {
          console.warn('API not available, using mock data for demo');
          // Mock configuration for demo purposes
          const mockConfig = {
            title: "SIP Goal Planning Calculator",
            description: "Configure your systematic investment plan based on your financial goals",
            fields: {
              always_required: [
                {
                  name: "goal_type",
                  label: "Goal Type",
                  type: "select",
                  required: true,
                  options: [
                    { value: "Retirement", label: "Retirement" },
                    { value: "Child Education", label: "Child Education" },
                    { value: "Child Marriage", label: "Child Marriage" },
                    { value: "House Purchase", label: "House Purchase" },
                    { value: "General Wealth Creation", label: "General Wealth Creation" }
                  ]
                },
                {
                  name: "current_age",
                  label: "Current Age",
                  type: "number",
                  required: true,
                  placeholder: "Enter your current age"
                },
                {
                  name: "currency",
                  label: "Currency",
                  type: "select",
                  required: true,
                  options: [
                    { value: "INR", label: "INR (₹)" },
                    { value: "USD", label: "USD ($)" },
                    { value: "EUR", label: "EUR (€)" }
                  ]
                },
                {
                  name: "target_amount_min",
                  label: "Target Amount",
                  type: "number",
                  required: true,
                  placeholder: "Enter target amount"
                },
                {
                  name: "risk_appetite",
                  label: "Risk Appetite",
                  type: "select",
                  required: true,
                  options: [
                    { value: "very_low", label: "Very Low Risk (5% returns)" },
                    { value: "low", label: "Low Risk (7% returns)" },
                    { value: "moderate", label: "Moderate Risk (10% returns)" },
                    { value: "high", label: "High Risk (12% returns)" },
                    { value: "very_high", label: "Very High Risk (15% returns)" }
                  ]
                }
              ]
            }
          };
          setFormConfig(mockConfig);
        }
        
      } catch (error) {
        console.error('Error loading form config:', error);
        setErrors({ general: 'Failed to load form configuration. Please check if the API is running.' });
      } finally {
        setLoading(false);
      }
    };

    loadInitialConfig();
  }, []);

  // Load conditional fields when goal type changes
  useEffect(() => {
    const loadConditionalFields = async () => {
      if (!formData.goal_type || !formConfig) return;

      try {
        setLoading(true);
        
        try {
          const response = await fetch(`${API_BASE_URL}/form-config/${formData.goal_type}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setConditionalFields(data.conditional_fields || []);
        } catch (apiError) {
          console.warn('API not available, using mock conditional fields');
          // Mock conditional fields based on goal type
          const mockConditionalFields = {
            "Retirement": [
              {
                name: "retirement_age",
                label: "Retirement Age",
                type: "number",
                required: true,
                placeholder: "Enter desired retirement age"
              }
            ],
            "Child Education": [
              {
                name: "child_current_age",
                label: "Child's Current Age",
                type: "number",
                required: true,
                placeholder: "Enter child's current age"
              },
              {
                name: "education_start_age",
                label: "Education Start Age",
                type: "number",
                required: true,
                placeholder: "Age when education starts"
              }
            ],
            "Child Marriage": [
              {
                name: "child_current_age",
                label: "Child's Current Age",
                type: "number",
                required: true,
                placeholder: "Enter child's current age"
              },
              {
                name: "marriage_age",
                label: "Expected Marriage Age",
                type: "number",
                required: true,
                placeholder: "Expected marriage age"
              }
            ],
            "House Purchase": [
              {
                name: "target_purchase_year",
                label: "Target Purchase Year",
                type: "number",
                required: true,
                placeholder: "Year you want to buy the house"
              }
            ],
            "General Wealth Creation": [
              {
                name: "override_time_horizon_years",
                label: "Investment Duration (Years)",
                type: "number",
                required: true,
                placeholder: "Number of years to invest"
              }
            ]
          };
          
          setConditionalFields(mockConditionalFields[formData.goal_type] || []);
        }
        
        // Clear existing conditional field values
        const newFormData = { ...formData };
        conditionalFields.forEach(field => {
          delete newFormData[field.name];
        });
        setFormData(newFormData);
        
        // Reset validation and results
        setValidationResult(null);
        setCalculationResult(null);
        setCurrentStep('form');
        setErrors({});
        
        console.log(`Loaded conditional fields for ${formData.goal_type}`);
        
      } catch (error) {
        console.error('Error loading conditional fields:', error);
        setErrors({ general: 'Failed to load goal-specific fields' });
      } finally {
        setLoading(false);
      }
    };

    loadConditionalFields();
  }, [formData.goal_type]); // Only depend on goal_type

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    let newValue = value;
    
    if (type === 'number') {
      newValue = value === '' ? '' : parseFloat(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Clear field-specific errors
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  // Validate form data
  const handleValidation = async () => {
    if (!isFormComplete()) {
      setErrors({ general: 'Please fill in all required fields' });
      return;
    }

    try {
      setValidationLoading(true);
      setErrors({});
      
      try {
        const response = await fetch(`${API_BASE_URL}/validate-form`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.valid) {
          setValidationResult(data);
          setCurrentStep('validation');
          console.log('Form validation successful');
        } else {
          setErrors({ general: data.message });
        }
      } catch (apiError) {
        console.warn('API not available, using mock validation');
        // Mock validation for demo
        const mockTimeHorizon = calculateMockTimeHorizon();
        const mockValidationResult = {
          valid: true,
          message: "Form validation successful (mock)",
          time_horizon_years: mockTimeHorizon,
          total_months: mockTimeHorizon * 12
        };
        
        setValidationResult(mockValidationResult);
        setCurrentStep('validation');
        console.log('Form validation successful (mock)');
      }
      
    } catch (error) {
      const errorMessage = error.message || 'Validation failed';
      setErrors({ general: `Validation failed: ${errorMessage}` });
      console.error('Validation error:', error);
    } finally {
      setValidationLoading(false);
    }
  };

  // Mock time horizon calculation for demo
  const calculateMockTimeHorizon = () => {
    const goalType = formData.goal_type;
    
    switch (goalType) {
      case "Retirement":
        return (formData.retirement_age || 60) - (formData.current_age || 30);
      case "Child Education":
        return (formData.education_start_age || 18) - (formData.child_current_age || 0);
      case "Child Marriage":
        return (formData.marriage_age || 25) - (formData.child_current_age || 0);
      case "House Purchase":
        return (formData.target_purchase_year || new Date().getFullYear() + 5) - new Date().getFullYear();
      case "General Wealth Creation":
        return formData.override_time_horizon_years || 10;
      default:
        return 10;
    }
  };

  // Add log entry without agent detection
  const addLogEntry = (type, message, timestamp) => {
    const logEntry = {
      id: Date.now() + Math.random(),
      type,
      message,
      timestamp: timestamp || new Date().toLocaleTimeString()
    };
    
    setStreamLogs(prev => [...prev, logEntry]);
  };

  // Add fund recommendation log entry
  const addFundLogEntry = (type, message, timestamp) => {
    const logEntry = {
      id: Date.now() + Math.random(),
      type,
      message,
      timestamp: timestamp || new Date().toLocaleTimeString()
    };
    
    setFundRecommendationLogs(prev => [...prev, logEntry]);
  };

  // Fetch HTML report content with proper error handling
  const fetchHtmlReport = async (filePath) => {
    try {
      addLogEntry('info', `Loading HTML report from: ${filePath}`, new Date().toLocaleTimeString());
      
      let htmlContent = '';
      let loadMethod = '';
      let fileLoadSuccess = false;
      
      try {
        // Method 1: Try to read file directly if in artifacts environment with file system API
        if (typeof window !== 'undefined' && window.fs && window.fs.readFile) {
          const fileContent = await window.fs.readFile(filePath, { encoding: 'utf8' });
          htmlContent = fileContent;
          loadMethod = 'file system';
          fileLoadSuccess = true;
          addLogEntry('success', 'Successfully loaded HTML report via file system', new Date().toLocaleTimeString());
        } else {
          throw new Error('File system API not available');
        }
      } catch (fsError) {
        try {
          // Method 2: Try to fetch via HTTP endpoint from backend
          const response = await fetch(`${API_BASE_URL}/download-report?filepath=${encodeURIComponent(filePath)}`, {
            method: 'GET',
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });
          
          if (response.ok) {
            htmlContent = await response.text();
            loadMethod = 'HTTP endpoint';
            fileLoadSuccess = true;
            addLogEntry('success', 'Successfully loaded HTML report via HTTP', new Date().toLocaleTimeString());
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (httpError) {
          try {
            // Method 3: Try alternative endpoint pattern
            const altResponse = await fetch(`${API_BASE_URL}/reports/${generatedFileName}`, {
              method: 'GET',
              headers: {
                'Accept': 'text/html'
              }
            });
            
            if (altResponse.ok) {
              htmlContent = await altResponse.text();
              loadMethod = 'alternative endpoint';
              fileLoadSuccess = true;
              addLogEntry('success', 'Successfully loaded HTML report via alternative endpoint', new Date().toLocaleTimeString());
            } else {
              throw new Error(`Alternative endpoint failed: ${altResponse.status}`);
            }
          } catch (altError) {
            // Method 4: Try to construct and fetch from static file path
            try {
              const staticPath = filePath.replace(/\\/g, '/').replace(/^.*\/media\//, '/media/');
              const staticResponse = await fetch(staticPath);
              
              if (staticResponse.ok) {
                htmlContent = await staticResponse.text();
                loadMethod = 'static file path';
                fileLoadSuccess = true;
                addLogEntry('success', 'Successfully loaded HTML report via static path', new Date().toLocaleTimeString());
              } else {
                throw new Error(`Static path failed: ${staticResponse.status}`);
              }
            } catch (staticError) {
              // Set error state when file loading fails
              addLogEntry('error', 'Error in processing - File not found', new Date().toLocaleTimeString());
              addLogEntry('error', `All methods failed: FS(${fsError.message}), HTTP(${httpError.message}), Alt(${altError.message}), Static(${staticError.message})`, new Date().toLocaleTimeString());
              
              setSipGoalError(true);
              setSipGoalCompleted(false);
              setErrors({ general: 'Error in processing - File not found. Please regenerate the report.' });
              
              htmlContent = generateMockHtmlReport();
              loadMethod = 'fallback mock';
            }
          }
        }
      }
      
      // Only append filename if using real content
      if (fileLoadSuccess && loadMethod !== 'fallback mock') {
        htmlContent = appendFilenameToHtmlReport(htmlContent);
      }
      
      setHtmlReportContent(htmlContent);
      // Store the file path for display
      setGeneratedFilePath(filePath);
      setReportPathForRecommendation(filePath);
      
      if (fileLoadSuccess) {
        addLogEntry('success', `HTML report ready for display (loaded via: ${loadMethod})`, new Date().toLocaleTimeString());
      }
      
    } catch (error) {
      console.error('Error fetching HTML report:', error);
      addLogEntry('error', `Error in processing - Failed to load HTML report: ${error.message}`, new Date().toLocaleTimeString());
      
      // Set error state when critical error occurs
      setSipGoalError(true);
      setSipGoalCompleted(false);
      setErrors({ general: 'Error in processing - Failed to load report. Please regenerate.' });
      
      // Final fallback to mock content
      addLogEntry('info', 'Using mock report as final fallback', new Date().toLocaleTimeString());
      setHtmlReportContent(generateMockHtmlReport());
    }
  };

  // Fetch Fund Recommendation HTML report content with proper error handling
  const fetchFundRecommendationHtmlReport = async (filePath) => {
    try {
      addFundLogEntry('info', `Loading Fund Recommendation HTML report from: ${filePath}`, new Date().toLocaleTimeString());
      
      let htmlContent = '';
      let loadMethod = '';
      let fileLoadSuccess = false;
      
      try {
        // Method 1: Try to read file directly if in artifacts environment with file system API
        if (typeof window !== 'undefined' && window.fs && window.fs.readFile) {
          const fileContent = await window.fs.readFile(filePath, { encoding: 'utf8' });
          htmlContent = fileContent;
          loadMethod = 'file system';
          fileLoadSuccess = true;
          addFundLogEntry('success', 'Successfully loaded Fund Recommendation HTML report via file system', new Date().toLocaleTimeString());
        } else {
          throw new Error('File system API not available');
        }
      } catch (fsError) {
        try {
          // Method 2: Try to fetch via HTTP endpoint from backend
          const response = await fetch(`${API_BASE_URL}/download-report?filepath=${encodeURIComponent(filePath)}`, {
            method: 'GET',
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });
          
          if (response.ok) {
            htmlContent = await response.text();
            loadMethod = 'HTTP endpoint';
            fileLoadSuccess = true;
            addFundLogEntry('success', 'Successfully loaded Fund Recommendation HTML report via HTTP', new Date().toLocaleTimeString());
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (httpError) {
          // Set error state when file loading fails
          addFundLogEntry('error', 'Error in processing - Fund recommendation file not found', new Date().toLocaleTimeString());
          addFundLogEntry('error', `Errors: FS(${fsError.message}), HTTP(${httpError.message})`, new Date().toLocaleTimeString());
          
          setFundRecommendationError(true);
          setFundRecommendationCompleted(false);
          setErrors({ general: 'Error in processing fund recommendation - File not found. Please regenerate.' });
          
          htmlContent = generateMockFundRecommendationReport();
          loadMethod = 'fallback mock';
        }
      }
      
      // Only append filename if using real content
      if (fileLoadSuccess && loadMethod !== 'fallback mock') {
        htmlContent = appendFilenameToHtmlReport(htmlContent, filePath);
      }
      
      setFundRecommendationHtmlContent(htmlContent);
      // Store the file path for display
      setFundRecommendationFilePath(filePath);
      
      if (fileLoadSuccess) {
        addFundLogEntry('success', `Fund Recommendation HTML report ready for display (loaded via: ${loadMethod})`, new Date().toLocaleTimeString());
      }
      
    } catch (error) {
      console.error('Error fetching Fund Recommendation HTML report:', error);
      addFundLogEntry('error', `Error in processing - Failed to load Fund Recommendation HTML report: ${error.message}`, new Date().toLocaleTimeString());
      
      // Set error state when critical error occurs
      setFundRecommendationError(true);
      setFundRecommendationCompleted(false);
      setErrors({ general: 'Error in processing fund recommendation - Failed to load report. Please regenerate.' });
      
      // Final fallback to mock content
      addFundLogEntry('info', 'Using mock fund recommendation report as final fallback', new Date().toLocaleTimeString());
      setFundRecommendationHtmlContent(generateMockFundRecommendationReport());
    }
  };

  // Append filename to HTML report
  const appendFilenameToHtmlReport = (htmlContent, filePath = null) => {
    const displayPath = filePath || generatedFilePath || generatedFileName;
    if (!displayPath) return htmlContent;
    
    // Check if filename is already in the content to avoid duplication
    if (htmlContent.includes(displayPath)) {
      return htmlContent;
    }
    
    // Create filename footer HTML
    const filenameFooter = `
      <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-top: 3px solid #007bff; text-align: center;">
        <p style="margin: 0; color: #495057; font-size: 0.9rem; font-family: monospace;">
          <strong>Report Path:</strong> ${displayPath}
        </p>
        <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 0.8rem;">
          Generated on ${new Date().toLocaleString()}
        </p>
      </div>
    </div>
    </body>
    </html>`;
    
    // Replace the closing tags with our footer + closing tags
    return htmlContent.replace(
      /<\/div>\s*<\/body>\s*<\/html>\s*$/i,
      filenameFooter
    );
  };

  // Generate mock HTML report for demo
  const generateMockHtmlReport = () => {
    const displayPath = generatedFilePath || generatedFileName || 'comprehensive_report.html';
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SIP Investment Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; color: #2c5aa0; }
            .summary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
            .metric { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
            .metric-value { font-size: 1.5rem; font-weight: bold; color: #007bff; }
            .chart-placeholder { background: #e9ecef; height: 200px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 20px 0; color: #6c757d; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
            th { background: #f8f9fa; font-weight: 600; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>SIP Investment Analysis Report</h1>
                <p>Generated on ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="summary">
                <h2>Investment Summary</h2>
                <p><strong>Goal Type:</strong> ${formData.goal_type}</p>
                <p><strong>Target Amount:</strong> ${formatCurrency(formData.target_amount_min, formData.currency)}</p>
                <p><strong>Time Horizon:</strong> ${validationResult?.time_horizon_years || 15} years</p>
                <p><strong>Risk Level:</strong> ${formData.risk_appetite}</p>
            </div>
            
            <div class="metrics">
                <div class="metric">
                    <div>Monthly SIP Amount</div>
                    <div class="metric-value">${formatCurrency(25000, formData.currency)}</div>
                </div>
                <div class="metric">
                    <div>Total Investment</div>
                    <div class="metric-value">${formatCurrency(4500000, formData.currency)}</div>
                </div>
                <div class="metric">
                    <div>Expected Returns</div>
                    <div class="metric-value">${formatCurrency(5500000, formData.currency)}</div>
                </div>
                <div class="metric">
                    <div>Final Amount</div>
                    <div class="metric-value">${formatCurrency(10000000, formData.currency)}</div>
                </div>
            </div>
            
            <h3>Recommendations</h3>
            <ul>
                <li>Start your SIP as early as possible to maximize compound growth</li>
                <li>Review your portfolio annually and rebalance if needed</li>
                <li>Consider increasing your SIP amount by 10% annually</li>
            </ul>
        </div>
    </body>
    </html>
    `;
  };

  // Generate mock Fund Recommendation HTML report for demo
  const generateMockFundRecommendationReport = () => {
    const displayPath = fundRecommendationFilePath || fundRecommendationFileName || 'fund_recommendation_report.html';
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fund Recommendation Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; color: #2c5aa0; }
            .summary { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .fund-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
            .fund-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Fund Recommendation Report</h1>
                <p>Customized for ${formData.goal_type} Goal</p>
            </div>
            
            <div class="summary">
                <h2>Investment Strategy Overview</h2>
                <p><strong>Goal Type:</strong> ${formData.goal_type}</p>
                <p><strong>Risk Profile:</strong> ${formData.risk_appetite}</p>
                <p><strong>Monthly SIP Amount:</strong> ${formatCurrency(25000, formData.currency)}</p>
            </div>
            
            <h3>Recommended Funds</h3>
            <div class="fund-grid">
                <div class="fund-card">
                    <h4>HDFC Top 100 Fund</h4>
                    <p><strong>Category:</strong> Large Cap Equity</p>
                    <p><strong>3Y CAGR:</strong> 12.5%</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
  };

  // Handle streaming calculation with completion tracking
  const handleCalculation = async () => {
    // Check if already completed and not in error state
    if (sipGoalCompleted && !sipGoalError) {
      console.log('SIP Goal already completed successfully, skipping re-trigger');
      setCurrentStep('results');
      return;
    }

    try {
      setIsStreaming(true);
      setStreamLogs([]);
      setGeneratedFileName('');
      setGeneratedFilePath('');
      setHtmlReportContent('');
      setStreamingProgress(0);
      setCurrentStep('streaming');
      setErrors({});
      // Reset error state when starting calculation
      setSipGoalError(false);
      
      const response = await fetch(`${API_BASE_URL}/calculate-sip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream completed');
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const rawData = line.slice(6).trim();
              
              if (!rawData) continue;
              
              try {
                const eventData = JSON.parse(rawData);
                handleStreamEvent(eventData);
                continue;
              } catch (jsonError) {
                // Handle raw text messages
                let progressIncremented = false;
                
                const agents = ['PlannerAgent', 'RetrieverAgent', 'ThinkerAgent', 'QAAgent', 'DistillerAgent', 'FormatterAgent', 'ReportGeneratorAgent'];
                
                for (const agent of agents) {
                  if (rawData.includes(agent)) {
                    setCurrentAgent(agent);
                    setStreamingProgress(prev => Math.min(prev + 10, 85));
                    addLogEntry('info', `Executing ${agent}`, new Date().toLocaleTimeString());
                    progressIncremented = true;
                    break;
                  }
                }
                
                if (!progressIncremented && rawData.includes('completed')) {
                  setStreamingProgress(prev => Math.min(prev + 5, 85));
                  addLogEntry('success', rawData, new Date().toLocaleTimeString());
                }
                
                if (rawData.includes('comprehensive_report.html')) {
                  setGeneratedFileName('comprehensive_report.html');
                  const pathMatch = rawData.match(/media[\\\/]generated[\\\/][\w\\\/]+[\\\/]comprehensive_report\.html/);
                  if (pathMatch) {
                    setGeneratedFilePath(pathMatch[0]);
                    setReportPathForRecommendation(pathMatch[0]);
                    fetchHtmlReport(pathMatch[0]);
                  }
                  setStreamingProgress(90);
                  addLogEntry('success', 'Generated comprehensive_report.html', new Date().toLocaleTimeString());
                }
                
                if (rawData.length > 3 && !rawData.startsWith('{') && !progressIncremented) {
                  addLogEntry('info', rawData, new Date().toLocaleTimeString());
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
    } catch (error) {
      const errorMessage = error.message || 'Stream connection failed';
      setErrors({ general: `Calculation failed: ${errorMessage}` });
      addLogEntry('error', `${errorMessage}`, new Date().toLocaleTimeString());
      console.error('Calculation error:', error);
      // Set error state to allow re-triggering
      setSipGoalError(true);
    } finally {
      setIsStreaming(false);
      
      if (streamingProgress >= 90) {
        setStreamingProgress(100);
        setCurrentAgent('');
        
        // Mark SIP goal as completed successfully
        setSipGoalCompleted(true);
        setSipGoalError(false);
        
        setTimeout(() => {
          setCurrentStep('results');
          addLogEntry('info', 'Processing completed - redirected to Results', new Date().toLocaleTimeString());
        }, 2000);
        
        setCalculationResult({
          calculation_result: {
            time_horizon_years: validationResult?.time_horizon_years || 0,
            total_months: validationResult?.total_months || 0,
            monthly_sip_amount: 25000,
            total_investment: 7500000,
            expected_returns: 2500000,
            risk_adjusted_returns: {
              conservative: 2200000,
              optimistic: 2800000,
              pessimistic: 1800000
            }
          }
        });
      }
    }
  };

  // Handle individual stream events with improved progress tracking
  const handleStreamEvent = (eventData) => {
    const { type, data, timestamp } = eventData;
    const timeStr = new Date((timestamp || Date.now() / 1000) * 1000).toLocaleTimeString();
    
    switch (type) {
      case 'connection_established':
        addLogEntry('info', 'Connection established', timeStr);
        setCurrentAgent('SIPGoalPlannerAgent');
        setStreamingProgress(10);
        break;
        
      case 'prompt_generated':
        addLogEntry('info', 'Prompt generated, starting agent execution...', timeStr);
        setCurrentAgent('SIPGoalPlannerAgent');
        setStreamingProgress(25);
        break;
        
      case 'file_generated':
        if (data.filename) {
          setGeneratedFileName(data.filename);
          if (data.filepath) {
            setGeneratedFilePath(data.filepath);
            setReportPathForRecommendation(data.filepath);
          }
          addLogEntry('success', `Generated file: ${data.filename}`, timeStr);
          
          if (data.filename.endsWith('.html') || data.filepath?.endsWith('.html')) {
            const filePath = data.filepath || data.filename;
            addLogEntry('info', `Fetching HTML report for display...`, timeStr);
            setCurrentAgent('ReportGeneratorAgent');
            fetchHtmlReport(filePath);
          }
        }
        setStreamingProgress(90);
        break;
        
      case 'stream_complete':
        addLogEntry('success', 'Stream completed successfully', timeStr);
        setCurrentAgent('');
        setStreamingProgress(100);
        
        // Mark SIP goal as completed successfully
        setSipGoalCompleted(true);
        setSipGoalError(false);
        
        setTimeout(() => {
          setCurrentStep('results');
          addLogEntry('info', 'Automatically redirected to Results tab', new Date().toLocaleTimeString());
        }, 2000);
        
        setCalculationResult({
          calculation_result: {
            time_horizon_years: validationResult?.time_horizon_years || 0,
            total_months: validationResult?.total_months || 0,
            monthly_sip_amount: 25000,
            total_investment: 7500000,
            expected_returns: 2500000,
            risk_adjusted_returns: {
              conservative: 2200000,
              optimistic: 2800000,
              pessimistic: 1800000
            }
          }
        });
        break;
        
      case 'stream_error':
      case 'fatal_error':
        addLogEntry('error', `${data.error || data.message}`, timeStr);
        setCurrentAgent('');
        setErrors({ general: data.error || data.message });
        // Set error state to allow re-triggering
        setSipGoalError(true);
        break;
        
      case 'stream_end':
        addLogEntry('info', 'Stream ended', timeStr);
        setCurrentAgent('');
        break;
        
      // Better agent processing detection
      case 'agent_processing':
        if (data.agent) {
          setCurrentAgent(data.agent);
          setStreamingProgress(prev => Math.min(prev + 10, 85));
          addLogEntry('info', `Processing with ${formatAgentName(data.agent)}`, timeStr);
        }
        break;
        
      case 'agent_response':
        const message = data.message || '';
        
        // Better agent detection from messages with progress updates
        const agentPatterns = [
          { pattern: /PlannerAgent/i, agent: 'PlannerAgent', progress: 40 },
          { pattern: /SIPGoalPlannerAgent/i, agent: 'SIPGoalPlannerAgent', progress: 30 },
          { pattern: /RetrieverAgent/i, agent: 'RetrieverAgent', progress: 50 },
          { pattern: /ThinkerAgent/i, agent: 'ThinkerAgent', progress: 60 },
          { pattern: /QAAgent/i, agent: 'QAAgent', progress: 70 },
          { pattern: /DistillerAgent/i, agent: 'DistillerAgent', progress: 55 },
          { pattern: /FormatterAgent/i, agent: 'FormatterAgent', progress: 75 },
          { pattern: /ReportGeneratorAgent/i, agent: 'ReportGeneratorAgent', progress: 80 }
        ];
        
        for (const { pattern, agent, progress } of agentPatterns) {
          if (pattern.test(message)) {
            setCurrentAgent(agent);
            setStreamingProgress(prev => Math.max(prev, progress));
            addLogEntry('info', `Executing ${formatAgentName(agent)}`, timeStr);
            break;
          }
        }
        
        addLogEntry('info', message, timeStr);
        break;
        
      default:
        if (data && typeof data === 'object') {
          const message = data.message || JSON.stringify(data);
          
          // Additional fallback agent detection with progressive updates
          const agentKeywords = [
            { keyword: 'PlannerAgent', progress: 40 },
            { keyword: 'SIPGoalPlannerAgent', progress: 30 },
            { keyword: 'RetrieverAgent', progress: 50 },
            { keyword: 'DistillerAgent', progress: 55 },
            { keyword: 'ThinkerAgent', progress: 60 },
            { keyword: 'QAAgent', progress: 70 },
            { keyword: 'FormatterAgent', progress: 75 },
            { keyword: 'ReportGeneratorAgent', progress: 80 }
          ];
          
          for (const { keyword, progress } of agentKeywords) {
            if (message.includes(keyword)) {
              setCurrentAgent(keyword);
              setStreamingProgress(prev => Math.max(prev, progress));
              addLogEntry('info', `Processing with ${formatAgentName(keyword)}`, timeStr);
              break;
            }
          }
          
          addLogEntry('info', message, timeStr);
        } else if (data && data.message) {
          addLogEntry('info', data.message, timeStr);
        }
        break;
    }
  };

  // Handle fund recommendation stream events with proper agent detection
  const handleFundRecommendationStreamEvent = (eventData) => {
    const { type, data, timestamp } = eventData;
    const timeStr = new Date((timestamp || Date.now() / 1000) * 1000).toLocaleTimeString();
    
    switch (type) {
      case 'connection_established':
        addFundLogEntry('info', 'Fund recommendation connection established', timeStr);
        setFundCurrentAgent('FundRecommendationOrchestrator');
        setFundRecommendationProgress(10);
        break;
        
      case 'file_generated':
        if (data.filename) {
          setFundRecommendationFileName(data.filename);
          if (data.filepath) {
            setFundRecommendationFilePath(data.filepath);
          }
          addFundLogEntry('success', `Generated fund recommendation file: ${data.filename}`, timeStr);
          
          if (data.filename.endsWith('.html') || data.filepath?.endsWith('.html')) {
            const filePath = data.filepath || data.filename;
            addFundLogEntry('info', `Fetching Fund Recommendation HTML report for display...`, timeStr);
            fetchFundRecommendationHtmlReport(filePath);
          }
        }
        setFundRecommendationProgress(95);
        break;
        
      case 'stream_complete':
        addFundLogEntry('success', 'Fund recommendation completed successfully', timeStr);
        setFundCurrentAgent('');
        setFundRecommendationProgress(100);
        
        // Mark fund recommendation as completed successfully
        setFundRecommendationCompleted(true);
        setFundRecommendationError(false);
        
        if (data.result) {
          setFundRecommendationResult(data.result);
        }
        
        setTimeout(() => {
          setCurrentStep('fund_recommendation_result');
          addFundLogEntry('info', 'Automatically redirected to Fund Recommendation Result tab', new Date().toLocaleTimeString());
        }, 2000);
        break;
        
      case 'stream_error':
      case 'fatal_error':
        addFundLogEntry('error', `${data.error || data.message}`, timeStr);
        setFundCurrentAgent('');
        setErrors({ general: data.error || data.message });
        // Set error state to allow re-triggering
        setFundRecommendationError(true);
        break;
        
      // Enhanced agent processing detection
      case 'agent_processing':
        if (data.agent) {
          setFundCurrentAgent(data.agent);
          setFundRecommendationProgress(prev => Math.min(prev + 10, 85));
          addFundLogEntry('info', `Processing with ${formatAgentName(data.agent)}`, timeStr);
        }
        break;
        
      case 'agent_response':
        const message = data.message || '';
        
        // Better agent detection from messages
        const agentPatterns = [
          { pattern: /FundRecommendationAgent/i, agent: 'FundRecommendationAgent' },
          { pattern: /RetrieverAgent/i, agent: 'RetrieverAgent' },
          { pattern: /ThinkerAgent/i, agent: 'ThinkerAgent' },
          { pattern: /QAAgent/i, agent: 'QAAgent' },
          { pattern: /DistillerAgent/i, agent: 'DistillerAgent' },
          { pattern: /FormatterAgent/i, agent: 'FormatterAgent' },
          { pattern: /ReportGeneratorAgent/i, agent: 'ReportGeneratorAgent' },
          { pattern: /FundRecommendationOrchestrator/i, agent: 'FundRecommendationOrchestrator' }
        ];
        
        for (const { pattern, agent } of agentPatterns) {
          if (pattern.test(message)) {
            setFundCurrentAgent(agent);
            setFundRecommendationProgress(prev => Math.min(prev + 5, 85));
            addFundLogEntry('info', `Executing ${formatAgentName(agent)}`, timeStr);
            break;
          }
        }
        
        addFundLogEntry('info', message, timeStr);
        break;
        
      default:
        if (data && data.message) {
          const message = data.message;
          
          // Additional fallback agent detection
          const agentKeywords = ['FundRecommendationAgent', 'RetrieverAgent', 'ThinkerAgent', 'QAAgent', 'DistillerAgent'];
          for (const keyword of agentKeywords) {
            if (message.includes(keyword)) {
              setFundCurrentAgent(keyword);
              setFundRecommendationProgress(prev => Math.min(prev + 5, 85));
              addFundLogEntry('info', `Processing with ${formatAgentName(keyword)}`, timeStr);
              break;
            }
          }
          
          addFundLogEntry('info', message, timeStr);
        }
        break;
    }
  };

  // Handle fund recommendation with completion tracking
  const handleFundRecommendation = async (reportPath) => {
    // Check if already completed and not in error state
    if (fundRecommendationCompleted && !fundRecommendationError) {
      console.log('Fund Recommendation already completed successfully, skipping re-trigger');
      setCurrentStep('fund_recommendation_result');
      return;
    }

    try {
      setIsFundRecommendationStreaming(true);
      setFundRecommendationLogs([]);
      setFundRecommendationProgress(0);
      setFundCurrentAgent('');
      setFundRecommendationFileName('');
      setFundRecommendationFilePath('');
      setFundRecommendationHtmlContent('');
      setCurrentStep('fund_recommendation');
      setErrors({});
      // Reset error state when starting fund recommendation
      setFundRecommendationError(false);
      
      const response = await fetch(`${API_BASE_URL}/fund-recommendation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          report_file_path: reportPath,
          form_data: formData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Fund recommendation stream completed');
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const rawData = line.slice(6).trim();
              
              if (!rawData) continue;
              
              try {
                const eventData = JSON.parse(rawData);
                handleFundRecommendationStreamEvent(eventData);
                continue;
              } catch (jsonError) {
                addFundLogEntry('info', rawData, new Date().toLocaleTimeString());
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
    } catch (error) {
      const errorMessage = error.message || 'Fund recommendation failed';
      setErrors({ general: `Fund recommendation failed: ${errorMessage}` });
      addFundLogEntry('error', errorMessage, new Date().toLocaleTimeString());
      console.error('Fund recommendation error:', error);
      // Set error state to allow re-triggering
      setFundRecommendationError(true);
    } finally {
      setIsFundRecommendationStreaming(false);
      
      if (fundRecommendationProgress >= 90) {
        setFundRecommendationProgress(100);
        setFundCurrentAgent('');
        addFundLogEntry('success', 'Fund recommendation completed', new Date().toLocaleTimeString());
      }
    }
  };

  // Stop streaming
  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
    addLogEntry('warning', 'Stream stopped by user', new Date().toLocaleTimeString());
  };

  // Stop fund recommendation streaming
  const stopFundRecommendationStreaming = () => {
    setIsFundRecommendationStreaming(false);
    addFundLogEntry('warning', 'Fund recommendation stream stopped by user', new Date().toLocaleTimeString());
  };

  // Check if form is complete
  const isFormComplete = () => {
    if (!formConfig) return false;
    
    for (const field of formConfig.fields.always_required) {
      if (field.required && (!formData[field.name] || formData[field.name] === '')) {
        return false;
      }
    }
    
    for (const field of conditionalFields) {
      if (field.required && (!formData[field.name] || formData[field.name] === '')) {
        return false;
      }
    }
    
    return true;
  };

  // Reset form to start over - enhanced to clear all tracking states
  const handleStartOver = () => {
    setFormData({ currency: 'INR' });
    setConditionalFields([]);
    setValidationResult(null);
    setCalculationResult(null);
    setCurrentStep('form');
    setErrors({});
    
    setStreamLogs([]);
    setGeneratedFileName('');
    setGeneratedFilePath('');
    setHtmlReportContent('');
    setStreamingProgress(0);
    setCurrentAgent('');
    setIsStreaming(false);
    
    setReportPathForRecommendation('');
    setFundRecommendationLogs([]);
    setFundRecommendationProgress(0);
    setIsFundRecommendationStreaming(false);
    setFundCurrentAgent('');
    setFundRecommendationResult(null);
    setFundRecommendationFileName('');
    setFundRecommendationFilePath('');
    setFundRecommendationHtmlContent('');
    
    // Reset completion tracking states
    setSipGoalCompleted(false);
    setFundRecommendationCompleted(false);
    setSipGoalError(false);
    setFundRecommendationError(false);
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    console.log('Form reset completed - all data cleared including completion tracking');
  };

  // Navigation handlers
  const handleNext = () => {
    switch (currentStep) {
      case 'form':
        handleValidation();
        break;
      case 'validation':
        handleCalculation();
        break;
      case 'streaming':
        if (streamingProgress === 100) {
          setCurrentStep('results');
        }
        break;
    }
  };

  const handlePrevious = () => {
    switch (currentStep) {
      case 'validation':
        setCurrentStep('form');
        break;
      case 'streaming':
        setCurrentStep('validation');
        break;
      case 'results':
        setCurrentStep('streaming');
        break;
      case 'fund_recommendation':
        setCurrentStep('results');
        break;
      case 'fund_recommendation_result':
        setCurrentStep('fund_recommendation');
        break;
    }
  };

  // Format agent name for display
  const formatAgentName = (agent) => {
    const agentNames = {
      'PlannerAgent': 'Planner Agent',
      'RetrieverAgent': 'Retriever Agent',
      'ThinkerAgent': 'Thinker Agent',
      'QAAgent': 'QA Agent',
      'DistillerAgent': 'Distiller Agent',
      'FormatterAgent': 'Formatter Agent',
      'CoderAgent': 'Coder Agent',
      'ExecutorAgent': 'Executor Agent',
      'ClarificationAgent': 'Clarification Agent',
      'SchedulerAgent': 'Scheduler Agent',
      'SIPGoalPlannerAgent': 'SIP Goal Planner Agent',
      'FundRecommendationAgent': 'Fund Recommendation Agent',
      'ReportGeneratorAgent': 'Report Generator Agent',
      'FundRecommendationOrchestrator': 'Fund Recommendation Orchestrator',
      'ReportReader': 'Report Reader Agent',
      'TemplateProcessor': 'Template Processor Agent',
      'TemplateLoader': 'Template Loader Agent'
    };
    return agentNames[agent] || 'Processing Agent';
  };

  // Render form field
  const renderField = (field) => {
    const { name, label, type, options, placeholder, required } = field;
    const fieldValue = formData[name] || '';
    
    if (type === 'select') {
      return (
        <div key={name} className="form-group">
          <label htmlFor={name} className="form-label">
            {label} {required && <span className="required">*</span>}
          </label>
          <select
            id={name}
            name={name}
            value={fieldValue}
            onChange={handleInputChange}
            required={required}
            className="form-select"
          >
            <option value="">Select {label}</option>
            {options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors[name] && <div className="field-error">{errors[name]}</div>}
        </div>
      );
    } else if (type === 'number') {
      return (
        <div key={name} className="form-group">
          <label htmlFor={name} className="form-label">
            {label} {required && <span className="required">*</span>}
          </label>
          <input
            type="number"
            id={name}
            name={name}
            value={fieldValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            required={required}
            className="form-input"
          />
          {errors[name] && <div className="field-error">{errors[name]}</div>}
        </div>
      );
    }
    
    return null;
  };

  // Format currency
  const formatCurrency = (amount, currency = 'INR') => {
    const symbols = { INR: '₹', USD: '$', EUR: '€' };
    return `${symbols[currency] || '₹'} ${amount?.toLocaleString() || '0'}`;
  };

  // Render loading state
  if (loading && !formConfig) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading SIP Goal Planning form...</p>
      </div>
    );
  }

  if (!formConfig) {
    return (
      <div className="error-container">
        <h3>Configuration Error</h3>
        <p>Unable to load form configuration. Please ensure the API is running and accessible.</p>
      </div>
    );
  }

  return (
    <div className="sip-form-container">
      {/* Progress Indicator */}
      <div className="progress-indicator">
        <div className={`step ${currentStep === 'form' ? 'active' : ''}`}>
          <span className="step-number">1</span>
          <span className="step-label">Fill Form</span>
        </div>
        <div className={`step ${currentStep === 'validation' ? 'active' : ''}`}>
          <span className="step-number">2</span>
          <span className="step-label">Validate</span>
        </div>
        <div className={`step ${currentStep === 'streaming' ? 'active' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">SIP Goal Processing</span>
        </div>
        <div className={`step ${currentStep === 'results' ? 'active' : ''}`}>
          <span className="step-number">4</span>
          <span className="step-label">SIP Goal Result</span>
        </div>
        <div className={`step ${currentStep === 'fund_recommendation' ? 'active' : ''}`}>
          <span className="step-number">5</span>
          <span className="step-label">Fund Recommendation Processing</span>
        </div>
        <div className={`step ${currentStep === 'fund_recommendation_result' ? 'active' : ''}`}>
          <span className="step-number">6</span>
          <span className="step-label">Fund Recommendation Result</span>
        </div>
      </div>

      {/* New SIP Calculation button for all steps (except form) */}
      {currentStep !== 'form' && (
        <div className="new-calculation-button-container">
          <button 
            onClick={handleStartOver}
            className="btn-new-calculation"
          >
            New SIP Calculation
          </button>
        </div>
      )}

      {/* Form Section */}
      {currentStep === 'form' && (
        <div className="form-section">
          <h3 className="section-title">Basic Information</h3>
          
          <div className="fields-grid">
            {formConfig.fields.always_required.map(renderField)}
          </div>

          {conditionalFields.length > 0 && (
            <>
              <h3 className="section-title">Goal Specific Information</h3>
              <div className="fields-grid">
                {conditionalFields.map(renderField)}
              </div>
            </>
          )}

          {errors.general && (
            <div className="error-message">
              {errors.general}
            </div>
          )}

          <div className="form-actions">
            <button 
              onClick={handleNext}
              disabled={validationLoading || !isFormComplete()}
              className="btn-primary"
            >
              {validationLoading ? 'Validating...' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Validation Results Section */}
      {currentStep === 'validation' && validationResult && (
        <div className="validation-section">
          <h3 className="section-title">Form Validation Results</h3>
          
          <div className="validation-results">
            <div className="validation-success">
              Form validation successful!
            </div>
            
            <div className="validation-details">
              <p><strong>Time Horizon:</strong> {validationResult.time_horizon_years} years</p>
              <p><strong>Total Months:</strong> {validationResult.total_months} months</p>
              <p><strong>Goal Type:</strong> {formData.goal_type}</p>
              <p><strong>Target Amount:</strong> {formatCurrency(formData.target_amount_min, formData.currency)}</p>
            </div>
          </div>

          <div className="form-actions">
            <button 
              onClick={handlePrevious}
              className="btn-secondary"
            >
              Previous
            </button>
            <button 
              onClick={handleNext}
              disabled={isStreaming}
              className="btn-primary"
            >
              {isStreaming ? 'Processing...' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* SIP Goal Processing Section */}
      {currentStep === 'streaming' && (
        <div className="streaming-section">
          <h3 className="section-title">SIP Goal Processing in Progress</h3>
          
          {currentAgent && (
            <div className="current-agent">
              <div className="agent-spinner"></div>
              <div className="agent-info">
                <h4>Currently Processing</h4>
                <p>{formatAgentName(currentAgent)}</p>
              </div>
            </div>
          )}
          
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${streamingProgress}%` }}
              ></div>
            </div>
            <span className="progress-text">{streamingProgress}%</span>
          </div>
          
          <div className="streaming-logs">
            <div className="logs-header">
              <h4>Processing Logs</h4>
              {isStreaming && (
                <button onClick={stopStreaming} className="btn-stop">
                  Stop
                </button>
              )}
            </div>
            
            <div className="logs-container">
              {streamLogs.map((log) => (
                <div key={log.id} className={`log-entry ${log.type}`}>
                  <span className="log-timestamp">{log.timestamp}</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

          <div className="form-actions">
            <button 
              onClick={handlePrevious}
              className="btn-secondary"
              disabled={isStreaming}
            >
              Previous
            </button>
            {streamingProgress === 100 && (
              <button 
                onClick={handleNext}
                className="btn-primary"
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}

      {/* SIP Goal Results Section */}
      {currentStep === 'results' && (
        <div className="results-section">
          <h3 className="section-title">Your SIP Goal Calculation Report</h3>
          
          {/* Error handling with regenerate option */}
          {sipGoalError && (
            <div className="error-section">
              <div className="error-message">
                Error in processing - Please regenerate the SIP calculation.
              </div>
              <div className="error-actions">
                <button 
                  onClick={() => {
                    setSipGoalError(false);
                    setSipGoalCompleted(false);
                    setCurrentStep('validation');
                  }}
                  className="btn-regenerate"
                >
                  Regenerate SIP Calculation
                </button>
              </div>
            </div>
          )}
          
          {/* Display file path */}
          {generatedFilePath && !sipGoalError && (
            <div className="file-path-display">
              <label className="file-path-label">Generated Report Path:</label>
              <div className="file-path-text">{generatedFilePath}</div>
            </div>
          )}
          
          {htmlReportContent && !sipGoalError && (
            <div className="html-report-section">
              <div className="report-header">
                <h4>Comprehensive Investment Report</h4>
                <div className="report-controls">
                  {(generatedFilePath || generatedFileName) && (
                    <span className="report-filename">
                      {generatedFilePath || generatedFileName}
                    </span>
                  )}
                  <button 
                    className="btn-download"
                    onClick={() => {
                      const blob = new Blob([htmlReportContent], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = generatedFileName || 'sip_report.html';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download Report
                  </button>
                </div>
              </div>
              
              <div className="html-report-container">
                <iframe
                  srcDoc={htmlReportContent}
                  title="SIP Investment Report"
                  className="html-report-iframe"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          )}

          <div className="form-actions">
            <button 
              onClick={handlePrevious}
              className="btn-secondary"
            >
              Previous
            </button>
            
            {reportPathForRecommendation && !sipGoalError && (
              <button 
                onClick={() => handleFundRecommendation(reportPathForRecommendation)}
                className="btn-primary"
                disabled={fundRecommendationCompleted && !fundRecommendationError}
              >
                {fundRecommendationCompleted && !fundRecommendationError 
                  ? 'View Fund Recommendations' 
                  : 'Get Fund Recommendations'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fund Recommendation Processing Section */}
      {currentStep === 'fund_recommendation' && (
        <div className="fund-recommendation-section">
          <h3 className="section-title">Fund Recommendation Processing</h3>
          
          <div className="report-path-display">
            <h4>Analyzing SIP Report:</h4>
            <p className="report-path">{reportPathForRecommendation}</p>
          </div>

          {fundCurrentAgent && (
            <div className="current-agent">
              <div className="agent-spinner"></div>
              <div className="agent-info">
                <h4>Currently Processing</h4>
                <p>{formatAgentName(fundCurrentAgent)}</p>
              </div>
            </div>
          )}

          <div className="progress-bar-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${fundRecommendationProgress}%` }}
              ></div>
            </div>
            <span className="progress-text">{fundRecommendationProgress}%</span>
          </div>

          <div className="streaming-logs">
            <div className="logs-header">
              <h4>Fund Recommendation Logs</h4>
              {isFundRecommendationStreaming && (
                <button onClick={stopFundRecommendationStreaming} className="btn-stop">
                  Stop
                </button>
              )}
            </div>
            
            <div className="logs-container">
              {fundRecommendationLogs.map((log) => (
                <div key={log.id} className={`log-entry ${log.type}`}>
                  <span className="log-timestamp">{log.timestamp}</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))}
              <div ref={fundLogsEndRef} />
            </div>
          </div>

          <div className="form-actions">
            <button 
              onClick={handlePrevious}
              className="btn-secondary"
              disabled={isFundRecommendationStreaming}
            >
              Back to Results
            </button>
            {fundRecommendationProgress === 100 && (
              <button 
                onClick={() => setCurrentStep('fund_recommendation_result')}
                className="btn-primary"
              >
                View Fund Recommendations
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fund Recommendation Result Section with error handling */}
      {currentStep === 'fund_recommendation_result' && (
        <div className="fund-result-section">
          <h3 className="section-title">Fund Recommendation Results</h3>
          
          {/* Error handling with regenerate option */}
          {fundRecommendationError && (
            <div className="error-section">
              <div className="error-message">
                Error in processing fund recommendation - Please regenerate.
              </div>
              <div className="error-actions">
                <button 
                  onClick={() => {
                    setFundRecommendationError(false);
                    setFundRecommendationCompleted(false);
                    setCurrentStep('results');
                  }}
                  className="btn-regenerate"
                >
                  Regenerate Fund Recommendation
                </button>
              </div>
            </div>
          )}
          
          {/* Display fund recommendation file path */}
          {fundRecommendationFilePath && !fundRecommendationError && (
            <div className="file-path-display">
              <label className="file-path-label">Generated Fund Recommendation Path:</label>
              <div className="file-path-text">{fundRecommendationFilePath}</div>
            </div>
          )}
          
          {/* HTML report display similar to SIP results */}
          {fundRecommendationHtmlContent && !fundRecommendationError && (
            <div className="html-report-section">
              <div className="report-header">
                <h4>Fund Recommendation Report</h4>
                <div className="report-controls">
                  {(fundRecommendationFilePath || fundRecommendationFileName) && (
                    <span className="report-filename">
                      {fundRecommendationFilePath || fundRecommendationFileName}
                    </span>
                  )}
                  <button 
                    className="btn-download"
                    onClick={() => {
                      const blob = new Blob([fundRecommendationHtmlContent], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = fundRecommendationFileName || 'fund_recommendation_report.html';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download Report
                  </button>
                </div>
              </div>
              
              <div className="html-report-container">
                <iframe
                  srcDoc={fundRecommendationHtmlContent}
                  title="Fund Recommendation Report"
                  className="html-report-iframe"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          )}

          {!fundRecommendationHtmlContent && !fundRecommendationError && (
            <div className="fund-results">
              <h4>Fund Recommendation Analysis</h4>
              <div className="fund-results-content">
                <p>Fund recommendation analysis completed successfully.</p>
                
                {(fundRecommendationFilePath || fundRecommendationFileName) && (
                  <div className="generated-file-result">
                    <label className="form-label">Generated Fund Recommendation File:</label>
                    <div className="file-display">
                      <input 
                        type="text" 
                        value={fundRecommendationFilePath || fundRecommendationFileName} 
                        readOnly 
                        className="form-input file-input"
                      />
                      <button className="btn-download">Open File</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button 
              onClick={handlePrevious}
              className="btn-secondary"
            >
              Back to Processing
            </button>
            <button 
              onClick={handleStartOver}
              className="btn-primary"
            >
              New SIP Calculation
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .sip-form-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        /* New SIP Calculation button styling */
        .new-calculation-button-container {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 20px;
        }

        .btn-new-calculation {
          background: #dc3545;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-new-calculation:hover {
          background: #c82333;
          transform: translateY(-1px);
        }

        /* File path display styling */
        .file-path-display {
          background: #f8f9fa;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }

        .file-path-label {
          display: block;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }

        .file-path-text {
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 10px 12px;
          font-family: monospace;
          font-size: 0.85rem;
          color: #1f2937;
          word-break: break-all;
          line-height: 1.4;
        }

        /* Error section styling */
        .error-section {
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          border: 1px solid #f87171;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 25px;
        }

        .error-actions {
          margin-top: 15px;
          display: flex;
          justify-content: center;
        }

        .btn-regenerate {
          background: #ef4444;
          color: white;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-regenerate:hover {
          background: #dc2626;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(220, 38, 38, 0.3);
        }

        .error-message {
          background: #fee2e2;
          color: #dc2626;
          padding: 15px 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          border: 1px solid #fecaca;
          text-align: center;
          font-weight: 600;
        }

        .progress-indicator {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          margin-bottom: 40px;
          gap: 20px;
          flex-wrap: wrap;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0.5;
          transition: opacity 0.3s;
          min-width: 120px;
          text-align: center;
        }

        .step.active {
          opacity: 1;
        }

        .step-number {
          width: 45px;
          height: 45px;
          border-radius: 50%;
          background: #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 1.1rem;
          border: 2px solid transparent;
        }

        .step.active .step-number {
          background: #3b82f6;
          color: white;
          border-color: #1d4ed8;
          box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
        }

        .step-label {
          font-size: 0.85rem;
          color: #6b7280;
          text-align: center;
          max-width: 120px;
          line-height: 1.3;
          font-weight: 500;
          word-wrap: break-word;
        }

        .step.active .step-label {
          color: #1f2937;
          font-weight: 600;
        }

        .form-section, .results-section, .validation-section, .fund-result-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .streaming-section, .fund-recommendation-section {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 1px solid #bae6fd;
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .fund-result-section {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1px solid #bbf7d0;
        }

        .section-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 25px;
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 10px;
        }

        .fields-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-label {
          font-weight: 500;
          color: #374151;
          margin-bottom: 8px;
        }

        .required {
          color: #ef4444;
        }

        .form-select, .form-input {
          width: 100%;
          padding: 12px 15px;
          border: 2px solid #d1d5db;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .form-select:focus, .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .file-input {
          background-color: #f9fafb;
          font-family: monospace;
          color: #1f2937;
        }

        .field-error {
          color: #ef4444;
          font-size: 0.875rem;
          margin-top: 5px;
        }

        .form-actions {
          display: flex;
          gap: 15px;
          justify-content: flex-end;
          margin-top: 30px;
        }

        .btn-primary, .btn-secondary, .btn-stop, .btn-download {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-primary:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .btn-stop {
          background: #ef4444;
          color: white;
          padding: 8px 16px;
          font-size: 0.875rem;
        }

        .btn-stop:hover {
          background: #dc2626;
        }

        .btn-download {
          background: #10b981;
          color: white;
          margin-left: 10px;
        }

        .btn-download:hover {
          background: #059669;
        }

        .progress-bar-container {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 25px;
        }

        .progress-bar {
          flex: 1;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #1d4ed8);
          transition: width 0.3s ease;
          border-radius: 4px;
        }

        .progress-text {
          font-weight: 600;
          color: #1f2937;
          min-width: 40px;
        }

        .current-agent {
          display: flex;
          align-items: center;
          gap: 20px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 25px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .agent-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e5e7eb;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          flex-shrink: 0;
        }

        .agent-info h4 {
          margin: 0 0 5px 0;
          color: #1f2937;
          font-size: 1rem;
          font-weight: 600;
        }

        .agent-info p {
          margin: 0;
          color: #3b82f6;
          font-size: 1.1rem;
          font-weight: 500;
        }

        .streaming-logs {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .logs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          border-radius: 8px 8px 0 0;
        }

        .logs-header h4 {
          margin: 0;
          color: #1f2937;
          font-size: 1.1rem;
        }

        .logs-container {
          height: 300px;
          overflow-y: auto;
          padding: 15px;
          background: #fafafa;
          border-radius: 0 0 8px 8px;
        }

        .log-entry {
          display: flex;
          gap: 15px;
          padding: 8px 12px;
          margin-bottom: 4px;
          border-radius: 6px;
          font-size: 0.9rem;
          border-left: 3px solid transparent;
        }

        .log-entry.info {
          background: #eff6ff;
          border-left-color: #3b82f6;
          color: #1e40af;
        }

        .log-entry.success {
          background: #ecfdf5;
          border-left-color: #10b981;
          color: #065f46;
        }

        .log-entry.error {
          background: #fee2e2;
          border-left-color: #ef4444;
          color: #dc2626;
        }

        .log-entry.warning {
          background: #fef3c7;
          border-left-color: #f59e0b;
          color: #92400e;
        }

        .log-timestamp {
          font-family: monospace;
          color: #6b7280;
          min-width: 80px;
          font-size: 0.8rem;
        }

        .log-message {
          flex: 1;
        }

        .generated-file, .generated-file-result {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .file-display {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .file-display .form-input {
          flex: 1;
        }

        .validation-section {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        }

        .validation-success {
          background: #dbeafe;
          color: #1d4ed8;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-weight: 600;
        }

        .validation-details {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .validation-details p {
          margin: 8px 0;
        }

        .results-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .html-report-section {
          background: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          margin-bottom: 30px;
          overflow: hidden;
        }

        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          background: rgba(255, 255, 255, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .report-header h4 {
          margin: 0;
          color: #f8fafc;
          font-size: 1.3rem;
        }

        .report-controls {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .report-filename {
          background: rgba(255, 255, 255, 0.2);
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.9rem;
          color: #e2e8f0;
          font-family: monospace;
        }

        .html-report-container {
          height: 600px;
          background: white;
        }

        .html-report-iframe {
          width: 100%;
          height: 100%;
          border: none;
          background: white;
        }

        .report-path-display {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          border: 1px solid #e5e7eb;
        }

        .report-path-display h4 {
          margin: 0 0 10px 0;
          color: #1f2937;
        }

        .report-path {
          background: #f3f4f6;
          padding: 10px 15px;
          border-radius: 6px;
          font-family: monospace;
          font-size: 0.9rem;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .fund-results {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .fund-results h4 {
          margin: 0 0 15px 0;
          color: #1f2937;
          font-size: 1.2rem;
        }

        .fund-results-content {
          color: #374151;
        }

        .fund-result-section .html-report-section {
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .fund-result-section .report-header {
          background: rgba(34, 197, 94, 0.1);
          border-bottom: 1px solid rgba(34, 197, 94, 0.2);
        }

        .fund-result-section .report-header h4 {
          color: #065f46;
        }

        .fund-result-section .report-filename {
          background: rgba(34, 197, 94, 0.2);
          color: #065f46;
        }

        .loading-container, .error-container {
          text-align: center;
          padding: 60px 20px;
        }

        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .sip-form-container {
            padding: 15px;
          }
          
          .fields-grid {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .progress-indicator {
            flex-wrap: wrap;
            gap: 10px;
          }

          .step-label {
            font-size: 0.8rem;
            max-width: 100px;
          }

          .file-display {
            flex-direction: column;
            align-items: stretch;
          }

          .logs-container {
            height: 200px;
          }

          .report-controls {
            flex-direction: column;
            gap: 10px;
          }

          .current-agent {
            flex-direction: column;
            text-align: center;
            gap: 15px;
          }

          .html-report-container {
            height: 400px;
          }

          .file-path-text {
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
};

export default SIPGoalPlanningForm;