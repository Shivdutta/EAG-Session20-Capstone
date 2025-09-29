import React, { useState, useEffect, useRef } from 'react';

export const API_BASE_URL = (() => {
  // Check if we're in the browser environment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If running on localhost, use local API
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.log('Using localhost API URL');
      return 'http://localhost:8000/api';
    }
    
    // If running on Azure (sifura.azurewebsites.net), use Azure API
    if (hostname.includes('azurewebsites.net') || hostname === 'sifura.azurewebsites.net') {
      console.log('Using Azure API URL');
      return 'https://myapp-backend-api.azurewebsites.net/api';
    }
  }
  
  // Check build-time environment variable as fallback
  if (process.env.REACT_APP_API_URL) {
    console.log('Using build-time env API URL:', process.env.REACT_APP_API_URL);
    return process.env.REACT_APP_API_URL;
  }
  
  // Default fallback to Azure production API
  console.log('Using default Azure API URL');
  return 'https://myapp-backend-api.azurewebsites.net/api';
})();

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
  const [currentStep, setCurrentStep] = useState('form');
  
  // Streaming states
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamLogs, setStreamLogs] = useState([]);
  const [generatedFileName, setGeneratedFileName] = useState('');
  const [generatedFilePath, setGeneratedFilePath] = useState('');
  const [htmlReportContent, setHtmlReportContent] = useState('');
  const [streamingProgress, setStreamingProgress] = useState(0);
  const [currentAgent, setCurrentAgent] = useState('');
  
  // NEW: Debug state for troubleshooting
  const [debugInfo, setDebugInfo] = useState({
    totalMessages: 0,
    filteredMessages: 0,
    agentLoopActive: false,
    lastBoundaryMessage: '',
    textOnlyCount: 0
  });

  // NEW: AgentLoop processing phase tracking
  const [isInAgentLoopProcessing, setIsInAgentLoopProcessing] = useState(false);
  
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

  useEffect(() => {
    fundLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [fundRecommendationLogs]);

  // Load initial configuration
  useEffect(() => {
    const loadInitialConfig = async () => {
      try {
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
        
        const newFormData = { ...formData };
        conditionalFields.forEach(field => {
          delete newFormData[field.name];
        });
        setFormData(newFormData);
        
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
  }, [formData.goal_type]);

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

  // UPDATED: Enhanced log filtering with comprehensive debugging
  const parseAndFilterLogMessage = (message) => {
    // Update debug info
    setDebugInfo(prev => ({
      ...prev,
      totalMessages: prev.totalMessages + 1,
      agentLoopActive: isInAgentLoopProcessing
    }));
    
    // Debug logging to console to see what messages are coming through
    console.log('🔍 Processing message:', message, '| AgentLoop active:', isInAgentLoopProcessing);
    
    // Check for processing phase boundaries - be more flexible with matching
    if (message.includes('Processing with AgentLoop') || 
        message.includes('AgentLoop4') ||
        message.includes('Starting execution') ||
        message.includes('Executing batch')) {
      console.log('✅ Found AgentLoop start boundary');
      setIsInAgentLoopProcessing(true);
      setDebugInfo(prev => ({
        ...prev,
        lastBoundaryMessage: 'START: ' + message.substring(0, 50),
        agentLoopActive: true
      }));
      return message; // Always show start boundary
    }
    
    if (message.includes('Query processed successfully') || 
        message.includes('successfully processed') ||
        message.includes('execution completed') ||
        message.includes('Processing completed')) {
      console.log('✅ Found AgentLoop end boundary');
      setIsInAgentLoopProcessing(false);
      setDebugInfo(prev => ({
        ...prev,
        lastBoundaryMessage: 'END: ' + message.substring(0, 50),
        agentLoopActive: false
      }));
      return message; // Always show end boundary
    }
    
    // If we're in the AgentLoop processing phase, only show "(text only)" messages
    if (isInAgentLoopProcessing) {
      console.log('🚫 In AgentLoop phase - filtering messages');
      
      // Check for various "(text only)" patterns
      const textOnlyPatterns = [
        /(\w+Agent)\s*\(text only\)/gi,
        /(\w+Agent)\s+\(text only\)/gi,
        /(\w+)\s*\(text only\)/gi,
        /\(text only\)/gi  // Just look for "(text only)" anywhere
      ];
      
      let foundTextOnly = false;
      for (const pattern of textOnlyPatterns) {
        if (pattern.test(message)) {
          foundTextOnly = true;
          setDebugInfo(prev => ({
            ...prev,
            textOnlyCount: prev.textOnlyCount + 1
          }));
          
          // Try to extract agent name
          const agentMatch = message.match(/(\w+Agent)/i);
          if (agentMatch) {
            const agentName = agentMatch[1];
            const formattedAgent = formatAgentName(agentName);
            console.log('✅ Found (text only) message:', agentName, '→', formattedAgent);
            return `Executing ${formattedAgent}`;
          } else {
            // If no agent name found, just show the message
            console.log('✅ Found (text only) message without agent name');
            return message;
          }
        }
      }
      
      if (!foundTextOnly) {
        // During AgentLoop processing, filter out everything except "(text only)" messages
        console.log('🚫 Filtered out non-(text only) message during AgentLoop:', message.substring(0, 100));
        setDebugInfo(prev => ({
          ...prev,
          filteredMessages: prev.filteredMessages + 1
        }));
        return null;
      }
    }
    
    // Outside of AgentLoop processing, show important messages
    if (message.includes('comprehensive_report.html') ||
        message.includes('Connection established') ||
        message.includes('Stream completed') ||
        message.includes('Generated file') ||
        message.includes('Prompt generated')) {
      console.log('✅ Showing important message outside AgentLoop');
      return message;
    }
    
    // Filter out other verbose processing noise
    if (message.toLowerCase().includes('processing') && 
        !message.includes('Executing') &&
        !message.includes('comprehensive_report.html')) {
      console.log('🚫 Filtered out processing noise');
      setDebugInfo(prev => ({
        ...prev,
        filteredMessages: prev.filteredMessages + 1
      }));
      return null;
    }
    
    console.log('✅ Showing regular message');
    return message;
  };

  // Add log entry with filtering
  const addLogEntry = (type, message, timestamp) => {
    const processedMessage = parseAndFilterLogMessage(message);
    
    if (processedMessage === null) {
      return;
    }
    
    const logEntry = {
      id: Date.now() + Math.random(),
      type,
      message: processedMessage,
      timestamp: timestamp || new Date().toLocaleTimeString()
    };
    
    setStreamLogs(prev => [...prev, logEntry]);
  };

  // Add fund recommendation log entry with filtering
  const addFundLogEntry = (type, message, timestamp) => {
    const processedMessage = parseAndFilterLogMessage(message);
    
    if (processedMessage === null) {
      return;
    }
    
    const logEntry = {
      id: Date.now() + Math.random(),
      type,
      message: processedMessage,
      timestamp: timestamp || new Date().toLocaleTimeString()
    };
    
    setFundRecommendationLogs(prev => [...prev, logEntry]);
  };

  // Fetch HTML report content with error handling
  const fetchHtmlReport = async (filePath) => {
    try {
      addLogEntry('info', `Loading HTML report from: ${filePath}`, new Date().toLocaleTimeString());
      
      let htmlContent = '';
      let loadMethod = '';
      let fileLoadSuccess = false;
      
      try {
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
          addLogEntry('error', 'Error in processing - File not found', new Date().toLocaleTimeString());
          
          setSipGoalError(true);
          setSipGoalCompleted(false);
          setErrors({ general: 'Error in processing - File not found. Please regenerate the report.' });
          
          htmlContent = generateMockHtmlReport();
          loadMethod = 'fallback mock';
        }
      }
      
      if (fileLoadSuccess && loadMethod !== 'fallback mock') {
        htmlContent = appendFilenameToHtmlReport(htmlContent);
      }
      
      setHtmlReportContent(htmlContent);
      setGeneratedFilePath(filePath);
      setReportPathForRecommendation(filePath);
      
      if (fileLoadSuccess) {
        addLogEntry('success', `HTML report ready for display (loaded via: ${loadMethod})`, new Date().toLocaleTimeString());
      }
      
    } catch (error) {
      console.error('Error fetching HTML report:', error);
      addLogEntry('error', `Error in processing - Failed to load HTML report: ${error.message}`, new Date().toLocaleTimeString());
      
      setSipGoalError(true);
      setSipGoalCompleted(false);
      setErrors({ general: 'Error in processing - Failed to load report. Please regenerate.' });
      
      addLogEntry('info', 'Using mock report as final fallback', new Date().toLocaleTimeString());
      setHtmlReportContent(generateMockHtmlReport());
    }
  };

  // Fetch Fund Recommendation HTML report content
  const fetchFundRecommendationHtmlReport = async (filePath) => {
    try {
      addFundLogEntry('info', `Loading Fund Recommendation HTML report from: ${filePath}`, new Date().toLocaleTimeString());
      
      let htmlContent = '';
      let loadMethod = '';
      let fileLoadSuccess = false;
      
      try {
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
          addFundLogEntry('error', 'Error in processing - Fund recommendation file not found', new Date().toLocaleTimeString());
          
          setFundRecommendationError(true);
          setFundRecommendationCompleted(false);
          setErrors({ general: 'Error in processing fund recommendation - File not found. Please regenerate.' });
          
          htmlContent = generateMockFundRecommendationReport();
          loadMethod = 'fallback mock';
        }
      }
      
      if (fileLoadSuccess && loadMethod !== 'fallback mock') {
        htmlContent = appendFilenameToHtmlReport(htmlContent, filePath);
      }
      
      setFundRecommendationHtmlContent(htmlContent);
      setFundRecommendationFilePath(filePath);
      
      if (fileLoadSuccess) {
        addFundLogEntry('success', `Fund Recommendation HTML report ready for display (loaded via: ${loadMethod})`, new Date().toLocaleTimeString());
      }
      
    } catch (error) {
      console.error('Error fetching Fund Recommendation HTML report:', error);
      addFundLogEntry('error', `Error in processing - Failed to load Fund Recommendation HTML report: ${error.message}`, new Date().toLocaleTimeString());
      
      setFundRecommendationError(true);
      setFundRecommendationCompleted(false);
      setErrors({ general: 'Error in processing fund recommendation - Failed to load report. Please regenerate.' });
      
      addFundLogEntry('info', 'Using mock fund recommendation report as final fallback', new Date().toLocaleTimeString());
      setFundRecommendationHtmlContent(generateMockFundRecommendationReport());
    }
  };

  // Append filename to HTML report
  const appendFilenameToHtmlReport = (htmlContent, filePath = null) => {
    const displayPath = filePath || generatedFilePath || generatedFileName;
    if (!displayPath) return htmlContent;
    
    if (htmlContent.includes(displayPath)) {
      return htmlContent;
    }
    
    const filenameFooter = `
      <div style="margin-top: 20px; padding: 12px; background: #f8f9fa; border-radius: 4px; border-top: 2px solid #007bff; text-align: center;">
        <p style="margin: 0; color: #495057; font-size: 0.8rem; font-family: monospace;">
          <strong>Report Path:</strong> ${displayPath}
        </p>
        <p style="margin: 3px 0 0 0; color: #6c757d; font-size: 0.7rem;">
          Generated on ${new Date().toLocaleString()}
        </p>
      </div>
    </div>
    </body>
    </html>`;
    
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
            body { font-family: Arial, sans-serif; margin: 0; padding: 12px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 16px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 16px; color: #2c5aa0; }
            .summary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; border-radius: 4px; margin: 12px 0; }
            .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 12px 0; }
            .metric { background: #f8f9fa; padding: 10px; border-radius: 4px; text-align: center; border-left: 3px solid #007bff; }
            .metric-value { font-size: 1.2rem; font-weight: bold; color: #007bff; }
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
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fund Recommendation Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 12px; background: #f5f5f5; }
            .container { max-width: 1000px; margin: 0 auto; background: white; padding: 16px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 16px; color: #2c5aa0; }
            .summary { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px; border-radius: 4px; margin: 12px 0; }
            .fund-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; margin: 12px 0; }
            .fund-card { background: #f8f9fa; padding: 12px; border-radius: 4px; border-left: 3px solid #10b981; }
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

  // Handle streaming calculation
  const handleCalculation = async () => {
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
      setSipGoalError(false);
      // UPDATED: Reset AgentLoop processing state
      setIsInAgentLoopProcessing(false);
      
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
                let progressIncremented = false;
                
                const agents = ['PlannerAgent', 'RetrieverAgent', 'ThinkerAgent', 'QAAgent', 'DistillerAgent', 'FormatterAgent', 'ReportGeneratorAgent'];
                
                for (const agent of agents) {
                  if (rawData.includes(agent)) {
                    setCurrentAgent(agent);
                    setStreamingProgress(prev => Math.min(prev + 10, 85));
                    addLogEntry('info', rawData, new Date().toLocaleTimeString());
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
      setSipGoalError(true);
    } finally {
      setIsStreaming(false);
      
      if (streamingProgress >= 90) {
        setStreamingProgress(100);
        setCurrentAgent('');
        
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

  // Handle individual stream events
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
        setSipGoalError(true);
        break;
        
      case 'stream_end':
        addLogEntry('info', 'Stream ended', timeStr);
        setCurrentAgent('');
        break;
        
      case 'agent_processing':
        if (data.agent) {
          setCurrentAgent(data.agent);
          setStreamingProgress(prev => Math.min(prev + 10, 85));
          addLogEntry('info', `Processing with ${formatAgentName(data.agent)}`, timeStr);
        }
        break;
        
      case 'agent_response':
        const message = data.message || '';
        
        if (parseAndFilterLogMessage(message)) {
          addLogEntry('info', message, timeStr);
        }
        
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
            break;
          }
        }
        break;
        
      default:
        if (data && typeof data === 'object') {
          const message = data.message || JSON.stringify(data);
          
          if (parseAndFilterLogMessage(message)) {
            addLogEntry('info', message, timeStr);
          }
          
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
              break;
            }
          }
        } else if (data && data.message) {
          if (parseAndFilterLogMessage(data.message)) {
            addLogEntry('info', data.message, timeStr);
          }
        }
        break;
    }
  };

  // Handle fund recommendation stream events
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
        setFundRecommendationError(true);
        break;
        
      case 'agent_processing':
        if (data.agent) {
          setFundCurrentAgent(data.agent);
          setFundRecommendationProgress(prev => Math.min(prev + 10, 85));
          addFundLogEntry('info', `Processing with ${formatAgentName(data.agent)}`, timeStr);
        }
        break;
        
      case 'agent_response':
        const message = data.message || '';
        
        if (parseAndFilterLogMessage(message)) {
          addFundLogEntry('info', message, timeStr);
        }
        
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
            break;
          }
        }
        break;
        
      default:
        if (data && data.message) {
          const message = data.message;
          
          if (parseAndFilterLogMessage(message)) {
            addFundLogEntry('info', message, timeStr);
          }
          
          const agentKeywords = ['FundRecommendationAgent', 'RetrieverAgent', 'ThinkerAgent', 'QAAgent', 'DistillerAgent'];
          for (const keyword of agentKeywords) {
            if (message.includes(keyword)) {
              setFundCurrentAgent(keyword);
              setFundRecommendationProgress(prev => Math.min(prev + 5, 85));
              break;
            }
          }
        }
        break;
    }
  };

  // Handle fund recommendation with completion tracking
  const handleFundRecommendation = async (reportPath) => {
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

  // Reset form to start over
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
    
    // UPDATED: Reset AgentLoop processing state
    setIsInAgentLoopProcessing(false);
    
    setReportPathForRecommendation('');
    setFundRecommendationLogs([]);
    setFundRecommendationProgress(0);
    setIsFundRecommendationStreaming(false);
    setFundCurrentAgent('');
    setFundRecommendationResult(null);
    setFundRecommendationFileName('');
    setFundRecommendationFilePath('');
    setFundRecommendationHtmlContent('');
    
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
        // If fund recommendation is completed, skip processing and go to results
        // If not completed or has error, go back to processing
        if (fundRecommendationCompleted && !fundRecommendationError) {
          setCurrentStep('results');
        } else {
          setCurrentStep('fund_recommendation');
        }
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

  // Render captured parameters for Tab 2
  const renderCapturedParameters = () => {
    const allParameters = { ...formData };
    
    if (validationResult) {
      allParameters.time_horizon_years = validationResult.time_horizon_years;
      allParameters.total_months = validationResult.total_months;
    }

    return (
      <div className="captured-parameters">
        <h4>All Captured Parameters</h4>
        <div className="parameters-grid">
          {Object.entries(allParameters).map(([key, value]) => {
            if (value === null || value === undefined || value === '') return null;
            
            const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            let displayValue = value;
            if (key.includes('amount') && typeof value === 'number') {
              displayValue = formatCurrency(value, formData.currency);
            } else if (typeof value === 'number') {
              displayValue = value.toLocaleString();
            } else if (typeof value === 'string') {
              displayValue = value;
            }
            
            return (
              <div key={key} className="parameter-item">
                <label className="parameter-label">{displayKey}:</label>
                <span className="parameter-value">{displayValue}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
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
        <div className={`step ${currentStep === 'fund_recommendation_result' ? 'active fund-result-step' : ''}`}>
          <span className="step-number">6</span>
          <span className="step-label">Fund Recommendation Result</span>
        </div>
      </div>

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

      {/* TAB 2: Validation Results Section */}
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
            
            {renderCapturedParameters()}
          </div>

          <div className="form-actions">
            <button 
              onClick={handleStartOver}
              className="btn-new-calculation"
            >
              New SIP Calculation
            </button>
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

      {/* TAB 3: SIP Goal Processing Section */}
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
          
          {/* Generated Report Path - ONE LINE */}
          {generatedFilePath && (
            <div className="report-path-display-inline">
              <span className="report-path-label">Generated Report Path:</span>
              <span className="report-path-value">{generatedFilePath}</span>
            </div>
          )}
          
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
              onClick={handleStartOver}
              className="btn-new-calculation"
            >
              New SIP Calculation
            </button>
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

      {/* TAB 4: SIP Goal Results Section */}
      {currentStep === 'results' && (
        <div className="results-section">
          <h3 className="section-title">Your SIP Goal Calculation Report</h3>
          
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
          
          {/* Generated Report Path - ONE LINE */}
          {generatedFilePath && !sipGoalError && (
            <div className="report-path-display-inline">
              <span className="report-path-label">Generated Report Path:</span>
              <span className="report-path-value">{generatedFilePath}</span>
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
              onClick={handleStartOver}
              className="btn-new-calculation"
            >
              New SIP Calculation
            </button>
            <button 
              onClick={handlePrevious}
              className="btn-secondary"
            >
              Previous
            </button>
            
            {reportPathForRecommendation && !sipGoalError && (
              <button 
                onClick={() => {
                  if (fundRecommendationCompleted && !fundRecommendationError) {
                    // If already completed, go directly to results
                    setCurrentStep('fund_recommendation_result');
                  } else {
                    // If not completed or has error, start the recommendation process
                    handleFundRecommendation(reportPathForRecommendation);
                  }
                }}
                className="btn-primary"
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
          
          {/* Analyzing SIP Report - ONE LINE */}
          <div className="report-path-display-inline">
            <span className="report-path-label">Analyzing SIP Report:</span>
            <span className="report-path-value">{reportPathForRecommendation}</span>
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

          {/* Fund Recommendation Report Path - ONE LINE */}
          {fundRecommendationFilePath && (
            <div className="report-path-display-inline">
              <span className="report-path-label">Generated Report Path:</span>
              <span className="report-path-value">{fundRecommendationFilePath}</span>
            </div>
          )}

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
              onClick={handleStartOver}
              className="btn-new-calculation"
            >
              New SIP Calculation
            </button>
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

      {/* TAB 6: Fund Recommendation Result Section - BLUE THEME */}
      {currentStep === 'fund_recommendation_result' && (
        <div className="fund-result-section">
          <h3 className="section-title">Fund Recommendation Results</h3>
          
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
          
          {/* Fund Recommendation Report Path - ONE LINE */}
          {fundRecommendationFilePath && !fundRecommendationError && (
            <div className="report-path-display-inline">
              <span className="report-path-label">Generated Report Path:</span>
              <span className="report-path-value">{fundRecommendationFilePath}</span>
            </div>
          )}
          
          {fundRecommendationHtmlContent && !fundRecommendationError && (
            <div className="html-report-section fund-report-section">
              <div className="report-header fund-report-header">
                <h4>Fund Recommendation Report</h4>
                <div className="report-controls">
                  {(fundRecommendationFilePath || fundRecommendationFileName) && (
                    <span className="report-filename fund-report-filename">
                      {fundRecommendationFilePath || fundRecommendationFileName}
                    </span>
                  )}
                  <button 
                    className="btn-download fund-btn-download"
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
                    Download Fund Report
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
              onClick={handleStartOver}
              className="btn-new-calculation"
            >
              New SIP Calculation
            </button>
            <button 
              onClick={handlePrevious}
              className="btn-secondary"
            >
              Back to Processing
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .sip-form-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        /* Button styling */
        .btn-new-calculation {
          background: #dc3545;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-right: auto; /* Pushes other buttons to the right */
        }

        .btn-new-calculation:hover {
          background: #c82333;
          transform: translateY(-1px);
        }

        /* ONE LINE Report Path Display */
        .report-path-display-inline {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 10px 12px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: nowrap;
        }

        .report-path-label {
          font-weight: 600;
          color: #495057;
          font-size: 0.85rem;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .report-path-value {
          background: #6c757d;
          color: white;
          padding: 6px 10px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 0.75rem;
          border: 1px solid #6c757d;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }

        /* Tab 6 Blue Theme */
        .fund-result-step {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        }

        .fund-result-step .step-number {
          background: #1d4ed8;
          color: white;
          border-color: #1e40af;
        }

        .fund-result-step .step-label {
          color: white;
          font-weight: 600;
        }

        .fund-result-section {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border: 1px solid #93c5fd;
          position: relative;
        }

        .fund-report-section {
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .fund-report-header {
          background: rgba(59, 130, 246, 0.1);
          border-bottom: 1px solid rgba(59, 130, 246, 0.2);
        }

        .fund-report-header h4 {
          color: #1e40af;
        }

        .fund-report-filename {
          background: rgba(59, 130, 246, 0.2);
          color: #1e40af;
        }

        .fund-btn-download {
          background: #3b82f6;
          color: white;
        }

        .fund-btn-download:hover {
          background: #2563eb;
        }

        /* Captured parameters styling */
        .captured-parameters {
          margin-top: 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 16px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .captured-parameters h4 {
          margin: 0 0 12px 0;
          color: #1f2937;
          font-size: 1rem;
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 6px;
          font-weight: 600;
        }

        .parameters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 10px;
        }

        .parameter-item {
          display: flex;
          flex-direction: column;
          background: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
          border-left: 3px solid #3b82f6;
          transition: all 0.2s;
        }

        .parameter-item:hover {
          background: #e9ecef;
          transform: translateY(-1px);
        }

        .parameter-label {
          font-weight: 600;
          color: #495057;
          font-size: 0.8rem;
          margin-bottom: 3px;
        }

        .parameter-value {
          color: #212529;
          font-size: 0.95rem;
          font-weight: 500;
        }

        /* Error section styling */
        .error-section {
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          border: 1px solid #f87171;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .error-actions {
          margin-top: 10px;
          display: flex;
          justify-content: center;
        }

        .btn-regenerate {
          background: #ef4444;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-regenerate:hover {
          background: #dc2626;
          transform: translateY(-1px);
        }

        .error-message {
          background: #fee2e2;
          color: #dc2626;
          padding: 10px 14px;
          border-radius: 4px;
          margin-bottom: 12px;
          border: 1px solid #fecaca;
          text-align: center;
          font-weight: 600;
        }

        .progress-indicator {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          margin-bottom: 20px;
          gap: 12px;
          flex-wrap: wrap;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0.5;
          transition: opacity 0.3s;
          min-width: 100px;
          text-align: center;
        }

        .step.active {
          opacity: 1;
        }

        .step-number {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          margin-bottom: 6px;
          font-size: 0.9rem;
          border: 2px solid transparent;
        }

        .step.active .step-number {
          background: #3b82f6;
          color: white;
          border-color: #1d4ed8;
          box-shadow: 0 3px 6px rgba(59, 130, 246, 0.3);
        }

        .step-label {
          font-size: 0.75rem;
          color: #6b7280;
          text-align: center;
          max-width: 100px;
          line-height: 1.2;
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
          border-radius: 6px;
          padding: 18px;
          margin-bottom: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .streaming-section, .fund-recommendation-section {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 1px solid #bae6fd;
          border-radius: 6px;
          padding: 18px;
          margin-bottom: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .section-title {
          font-size: 1.2rem;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 16px;
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 6px;
        }

        .fields-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-label {
          font-weight: 500;
          color: #374151;
          margin-bottom: 5px;
        }

        .required {
          color: #ef4444;
        }

        .form-select, .form-input {
          width: 100%;
          padding: 8px 10px;
          border: 2px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.9rem;
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
          font-size: 0.75rem;
          margin-top: 3px;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
          position: relative;
        }

        .form-actions .btn-new-calculation {
          margin-right: 0; /* Remove auto margin */
        }

        .form-actions > .btn-new-calculation ~ * {
          margin-left: auto; /* Push remaining buttons to the right */
        }

        .form-actions > .btn-new-calculation:first-child ~ .btn-secondary:first-of-type {
          margin-left: auto; /* Ensure proper spacing */
        }

        .btn-primary, .btn-secondary, .btn-stop, .btn-download {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 0.9rem;
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
          padding: 5px 10px;
          font-size: 0.8rem;
        }

        .btn-stop:hover {
          background: #dc2626;
        }

        .btn-download {
          background: #10b981;
          color: white;
          margin-left: 8px;
        }

        .btn-download:hover {
          background: #059669;
        }

        .progress-bar-container {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }

        .progress-bar {
          flex: 1;
          height: 5px;
          background: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #1d4ed8);
          transition: width 0.3s ease;
          border-radius: 2px;
        }

        .progress-text {
          font-weight: 600;
          color: #1f2937;
          min-width: 32px;
        }

        .current-agent {
          display: flex;
          align-items: center;
          gap: 14px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 14px;
          margin-bottom: 16px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .agent-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid #e5e7eb;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          flex-shrink: 0;
        }

        .agent-info h4 {
          margin: 0 0 3px 0;
          color: #1f2937;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .agent-info p {
          margin: 0;
          color: #3b82f6;
          font-size: 0.95rem;
          font-weight: 500;
        }

        .streaming-logs {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          margin-bottom: 14px;
        }

        .logs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          border-radius: 4px 4px 0 0;
        }

        .logs-header h4 {
          margin: 0;
          color: #1f2937;
          font-size: 0.95rem;
        }

        .logs-container {
          height: 200px;
          overflow-y: auto;
          padding: 10px;
          background: #fafafa;
          border-radius: 0 0 4px 4px;
        }

        .log-entry {
          display: flex;
          gap: 10px;
          padding: 5px 8px;
          margin-bottom: 2px;
          border-radius: 3px;
          font-size: 0.8rem;
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
          min-width: 65px;
          font-size: 0.7rem;
        }

        .log-message {
          flex: 1;
        }

        .generated-file, .generated-file-result {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 4px;
          padding: 14px;
          margin-bottom: 14px;
        }

        .file-display {
          display: flex;
          align-items: center;
          gap: 8px;
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
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 14px;
          font-weight: 600;
        }

        .validation-details {
          background: white;
          padding: 14px;
          border-radius: 4px;
          margin-bottom: 14px;
        }

        .validation-details p {
          margin: 5px 0;
        }

        .results-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .html-report-section {
          background: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          margin-bottom: 20px;
          overflow: hidden;
        }

        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px;
          background: rgba(255, 255, 255, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .report-header h4 {
          margin: 0;
          color: #f8fafc;
          font-size: 1.1rem;
        }

        .report-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .report-filename {
          background: rgba(255, 255, 255, 0.2);
          padding: 5px 8px;
          border-radius: 3px;
          font-size: 0.8rem;
          color: #e2e8f0;
          font-family: monospace;
        }

        .html-report-container {
          height: 400px;
          background: white;
        }

        .html-report-iframe {
          width: 100%;
          height: 100%;
          border: none;
          background: white;
        }

        .fund-results {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 14px;
          margin-bottom: 14px;
        }

        .fund-results h4 {
          margin: 0 0 10px 0;
          color: #1f2937;
          font-size: 1rem;
        }

        .fund-results-content {
          color: #374151;
        }

        .loading-container, .error-container {
          text-align: center;
          padding: 40px 20px;
        }

        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          animation: spin 1s linear infinite;
          margin: 0 auto 14px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .sip-form-container {
            padding: 8px;
          }
          
          .fields-grid {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .progress-indicator {
            flex-wrap: wrap;
            gap: 8px;
          }

          .step-label {
            font-size: 0.7rem;
            max-width: 80px;
          }

          .file-display {
            flex-direction: column;
            align-items: stretch;
          }

          .logs-container {
            height: 160px;
          }

          .report-controls {
            flex-direction: column;
            gap: 8px;
          }

          .current-agent {
            flex-direction: column;
            text-align: center;
            gap: 10px;
          }

          .html-report-container {
            height: 300px;
          }

          .report-path-value {
            font-size: 0.7rem;
          }

          .parameters-grid {
            grid-template-columns: 1fr;
          }

          .report-path-display-inline {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
          }

          .report-path-display-inline .report-path-value {
            width: 100%;
            white-space: normal;
            word-break: break-all;
          }

          .section-title {
            font-size: 1.1rem;
          }

          .step-number {
            width: 32px;
            height: 32px;
            font-size: 0.8rem;
          }
        }

        /* Compact spacing for minimized vertical scroll */
        .section-title {
          margin-bottom: 12px;
        }

        .form-section, .results-section, .validation-section, .fund-result-section,
        .streaming-section, .fund-recommendation-section {
          padding: 16px;
          margin-bottom: 10px;
        }

        .progress-indicator {
          margin-bottom: 16px;
        }

        .captured-parameters {
          margin-top: 12px;
          padding: 14px;
        }

        .validation-details {
          margin-bottom: 12px;
        }

        .html-report-section {
          margin-bottom: 16px;
        }

        .streaming-logs {
          margin-bottom: 12px;
        }

        .progress-bar-container {
          margin-bottom: 14px;
        }

        .current-agent {
          margin-bottom: 14px;
          padding: 12px;
        }

        .error-section {
          margin-bottom: 14px;
          padding: 10px;
        }

        .generated-file, .generated-file-result {
          margin-bottom: 12px;
          padding: 12px;
        }

        .fund-results {
          margin-bottom: 12px;
          padding: 12px;
        }
      `}</style>
    </div>
  );
};

export default SIPGoalPlanningForm;

        