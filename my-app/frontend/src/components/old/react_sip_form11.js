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
  const [currentStep, setCurrentStep] = useState('form'); // 'form', 'validation', 'streaming', 'results', 'fund_recommendation'
  
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
  
  const eventSourceRef = useRef(null);
  const logsEndRef = useRef(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamLogs]);

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

  // Fetch HTML report content
  const fetchHtmlReport = async (filePath) => {
    try {
      addLogEntry('info', `Loading HTML report from: ${filePath}`, new Date().toLocaleTimeString());
      
      let htmlContent = '';
      let loadMethod = '';
      
      try {
        // Method 1: Try to read file directly if in artifacts environment with file system API
        if (typeof window !== 'undefined' && window.fs && window.fs.readFile) {
          const fileContent = await window.fs.readFile(filePath, { encoding: 'utf8' });
          htmlContent = fileContent;
          loadMethod = 'file system';
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
                addLogEntry('success', 'Successfully loaded HTML report via static path', new Date().toLocaleTimeString());
              } else {
                throw new Error(`Static path failed: ${staticResponse.status}`);
              }
            } catch (staticError) {
              addLogEntry('warning', 'All loading methods failed, using mock report for demo', new Date().toLocaleTimeString());
              addLogEntry('error', `Errors: FS(${fsError.message}), HTTP(${httpError.message}), Alt(${altError.message}), Static(${staticError.message})`, new Date().toLocaleTimeString());
              htmlContent = generateMockHtmlReport();
              loadMethod = 'fallback mock';
            }
          }
        }
      }
      
      // Only append filename if using mock content or if filename is not already in the content
      if (loadMethod !== 'fallback mock') {
        htmlContent = appendFilenameToHtmlReport(htmlContent);
      }
      
      setHtmlReportContent(htmlContent);
      setReportPathForRecommendation(filePath); // Store the path for fund recommendation
      addLogEntry('success', `HTML report ready for display (loaded via: ${loadMethod})`, new Date().toLocaleTimeString());
      
    } catch (error) {
      console.error('Error fetching HTML report:', error);
      addLogEntry('error', `Failed to load HTML report: ${error.message}`, new Date().toLocaleTimeString());
      
      // Final fallback to mock content
      addLogEntry('info', 'Using mock report as final fallback', new Date().toLocaleTimeString());
      setHtmlReportContent(generateMockHtmlReport());
    }
  };

  // Append filename to HTML report
  const appendFilenameToHtmlReport = (htmlContent) => {
    if (!generatedFilePath && !generatedFileName) return htmlContent;
    
    const displayPath = generatedFilePath || generatedFileName;
    
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
            .filename-footer { margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-top: 3px solid #007bff; text-align: center; }
            .filename-footer p { margin: 0; color: #495057; font-size: 0.9rem; font-family: monospace; }
            .filename-footer .timestamp { margin: 5px 0 0 0; color: #6c757d; font-size: 0.8rem; }
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
            
            <h3>Growth Projection</h3>
            <div class="chart-placeholder">
                [Investment Growth Chart Would Be Displayed Here]<br>
                Line chart showing portfolio growth over time
            </div>
            
            <h3>Year-wise Breakdown</h3>
            <table>
                <thead>
                    <tr>
                        <th>Year</th>
                        <th>Annual Investment</th>
                        <th>Interest Earned</th>
                        <th>Portfolio Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>${formatCurrency(300000, formData.currency)}</td><td>${formatCurrency(15000, formData.currency)}</td><td>${formatCurrency(315000, formData.currency)}</td></tr>
                    <tr><td>5</td><td>${formatCurrency(1500000, formData.currency)}</td><td>${formatCurrency(285000, formData.currency)}</td><td>${formatCurrency(1785000, formData.currency)}</td></tr>
                    <tr><td>10</td><td>${formatCurrency(3000000, formData.currency)}</td><td>${formatCurrency(1250000, formData.currency)}</td><td>${formatCurrency(4250000, formData.currency)}</td></tr>
                    <tr><td>15</td><td>${formatCurrency(4500000, formData.currency)}</td><td>${formatCurrency(3200000, formData.currency)}</td><td>${formatCurrency(7700000, formData.currency)}</td></tr>
                </tbody>
            </table>
            
            <h3>Recommendations</h3>
            <ul>
                <li>Start your SIP as early as possible to maximize compound growth</li>
                <li>Review your portfolio annually and rebalance if needed</li>
                <li>Consider increasing your SIP amount by 10% annually</li>
                <li>Stay invested for the full duration to achieve your goal</li>
                <li>Monitor market conditions but avoid emotional investment decisions</li>
            </ul>
            
            <div style="margin-top: 30px; padding: 20px; background: #d4edda; border-radius: 8px; border: 1px solid #c3e6cb;">
                <p style="margin: 0; color: #155724;"><strong>Note:</strong> This report is generated based on historical market performance and assumptions. Actual returns may vary based on market conditions, fund performance, and other factors.</p>
            </div>
            
            <div class="filename-footer">
                <p><strong>Report Path:</strong> ${displayPath}</p>
                <p class="timestamp">Generated on ${new Date().toLocaleString()}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  };

  // Handle streaming calculation with EventSource
  const handleCalculation = async () => {
    try {
      setIsStreaming(true);
      setStreamLogs([]);
      setGeneratedFileName('');
      setGeneratedFilePath('');
      setHtmlReportContent('');
      setStreamingProgress(0);
      setCurrentStep('streaming');
      setErrors({});
      
      // Since EventSource doesn't support POST with body, we'll use fetch instead
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
      let progressCounter = 10; // Start at 10%

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream completed');
            break;
          }

          const chunk = decoder.decode(value);
          console.log('Raw chunk received:', chunk); // Debug: see raw data
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            console.log('Processing line:', line); // Debug: see each line
            
            if (line.startsWith('data: ')) {
              const rawData = line.slice(6).trim();
              console.log('Stream data:', rawData); // Debug: see stream data
              
              if (!rawData) continue;
              
              // Try to parse as JSON first
              try {
                const eventData = JSON.parse(rawData);
                console.log('Parsed JSON event:', eventData);
                handleStreamEvent(eventData);
                continue;
              } catch (jsonError) {
                // Not JSON, treat as raw text
                console.log('Raw text message:', rawData);
              }
              
              // Handle raw text messages
              let progressIncremented = false;
              
              // Agent detection - simple string matching
              const agents = ['PlannerAgent', 'RetrieverAgent', 'ThinkerAgent', 'QAAgent', 'DistillerAgent', 'FormatterAgent', 'ReportGeneratorAgent'];
              
              for (const agent of agents) {
                if (rawData.includes(agent)) {
                  console.log('Agent detected:', agent);
                  setCurrentAgent(agent);
                  setStreamingProgress(prev => {
                    const newProgress = Math.min(prev + 10, 85);
                    console.log('Progress updated:', prev, '->', newProgress);
                    return newProgress;
                  });
                  addLogEntry('info', `Executing ${agent}`, new Date().toLocaleTimeString());
                  progressIncremented = true;
                  break;
                }
              }
              
              // Task completion detection
              if (!progressIncremented && rawData.includes('completed')) {
                console.log('Completion detected');
                setStreamingProgress(prev => {
                  const newProgress = Math.min(prev + 5, 85);
                  console.log('Progress updated (completion):', prev, '->', newProgress);
                  return newProgress;
                });
                addLogEntry('success', rawData, new Date().toLocaleTimeString());
              }
              
              // File generation detection
              if (rawData.includes('comprehensive_report.html')) {
                console.log('File generation detected');
                setGeneratedFileName('comprehensive_report.html');
                const pathMatch = rawData.match(/media[\\\/]generated[\\\/][\w\\\/]+[\\\/]comprehensive_report\.html/);
                if (pathMatch) {
                  setGeneratedFilePath(pathMatch[0]);
                  setReportPathForRecommendation(pathMatch[0]); // Store for fund recommendation
                  fetchHtmlReport(pathMatch[0]);
                }
                setStreamingProgress(90);
                addLogEntry('success', 'Generated comprehensive_report.html', new Date().toLocaleTimeString());
              }
              
              // Always log non-empty messages
              if (rawData.length > 3 && !rawData.startsWith('{') && !progressIncremented) {
                addLogEntry('info', rawData, new Date().toLocaleTimeString());
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
    } finally {
      setIsStreaming(false);
      
      // Ensure we reach 100% when done
      if (streamingProgress >= 90) {
        setStreamingProgress(100);
        setCurrentAgent('');
        
        // Auto-redirect to results tab
        setTimeout(() => {
          setCurrentStep('results');
          addLogEntry('info', 'Processing completed - redirected to Results', new Date().toLocaleTimeString());
        }, 2000);
        
        // Set mock calculation result for display
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
            setReportPathForRecommendation(data.filepath); // Store for fund recommendation
          }
          addLogEntry('success', `Generated file: ${data.filename}`, timeStr);
          
          // If it's an HTML report, fetch and display it
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
        
        // Auto-redirect to results tab after a short delay
        setTimeout(() => {
          setCurrentStep('results');
          addLogEntry('info', 'Automatically redirected to Results tab', new Date().toLocaleTimeString());
        }, 2000);
        
        // Set mock calculation result for display
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
        break;
        
      case 'stream_end':
        addLogEntry('info', 'Stream ended', timeStr);
        setCurrentAgent('');
        break;
        
      default:
        // Handle raw agent execution data from your backend
        if (data && typeof data === 'object') {
          // Try to extract agent info from the raw stream
          const message = data.message || JSON.stringify(data);
          
          if (message.includes('PlannerAgent') ) {
            setCurrentAgent('PlannerAgent');
            setStreamingProgress(Math.min(streamingProgress + 5, 75));
          } else if (message.includes('SIPGoalPlannerAgent') ) {
            setCurrentAgent('SIPGoalPlannerAgent');
            setStreamingProgress(Math.min(streamingProgress + 5, 75));
          } else if (message.includes('RetrieverAgent') ) {
            setCurrentAgent('RetrieverAgent');
            setStreamingProgress(Math.min(streamingProgress + 5, 75));
          } else if (message.includes('DistillerAgent') ) {
            setCurrentAgent('DistillerAgent');
            setStreamingProgress(Math.min(streamingProgress + 5, 75));
          } else if (message.includes('ThinkerAgent') ) {
            setCurrentAgent('ThinkerAgent');
            setStreamingProgress(Math.min(streamingProgress + 5, 75));
          } else if (message.includes('QAAgent') ) {
            setCurrentAgent('QAAgent');
            setStreamingProgress(Math.min(streamingProgress + 5, 75));
          } else if (message.includes('FormatterAgent') ) {
            setCurrentAgent('FormatterAgent');
            setStreamingProgress(Math.min(streamingProgress + 5, 75));
          } else if (message.includes('ReportGeneratorAgent') ) {
            setCurrentAgent('ReportGeneratorAgent');
            setStreamingProgress(Math.min(streamingProgress + 5, 75));
          } else if (message.includes('CoderAgent')) {
            setCurrentAgent('CoderAgent');
            setStreamingProgress(Math.min(streamingProgress + 5, 75));
          } else if (message.includes('ClarificationAgent')) {
            setCurrentAgent('ClarificationAgent');
            setStreamingProgress(Math.min(streamingProgress + 5, 75));
          } else if (message.includes('SchedulerAgent')) {
            setCurrentAgent('SchedulerAgent');
            setStreamingProgress(Math.min(streamingProgress + 5, 75));
          } else if (message.includes('FundRecommendationAgent')) {
            setCurrentAgent('FundRecommendationAgent');
            setStreamingProgress(Math.min(streamingProgress + 5, 75));
          } 
          
          // Log the agent activity
          addLogEntry('info', message, timeStr);
        } else if (data && data.message) {
          addLogEntry('info', data.message, timeStr);
        }
        break;
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

  // Check if form is complete
  const isFormComplete = () => {
    if (!formConfig) return false;
    
    // Check always required fields
    for (const field of formConfig.fields.always_required) {
      if (field.required && (!formData[field.name] || formData[field.name] === '')) {
        return false;
      }
    }
    
    // Check conditional fields
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
    setReportPathForRecommendation(''); // Reset fund recommendation path
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  };

  // Handle fund recommendation
  const handleFundRecommendation = (reportPath) => {
    console.log('Starting fund recommendation with report:', reportPath);
    
    // Set to fund recommendation step
    setCurrentStep('fund_recommendation');
    
    // You can implement additional logic here like:
    // - Call an API endpoint for fund recommendations
    // - Pass the report path to another service
    // - Open a modal or new tab
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
      'ReportGeneratorAgent': 'Report Generator Agent'
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
          <span className="step-label">Processing</span>
        </div>
        <div className={`step ${currentStep === 'results' ? 'active' : ''}`}>
          <span className="step-number">4</span>
          <span className="step-label">Results</span>
        </div>
        <div className={`step ${currentStep === 'fund_recommendation' ? 'active' : ''}`}>
          <span className="step-number">5</span>
          <span className="step-label">Fund Recommendations</span>
        </div>
      </div>

      {/* Form Section */}
      {currentStep === 'form' && (
        <div className="form-section">
          <h3 className="section-title">Basic Information</h3>
          
          {/* Always Required Fields */}
          <div className="fields-grid">
            {formConfig.fields.always_required.map(renderField)}
          </div>

          {/* Conditional Fields */}
          {conditionalFields.length > 0 && (
            <>
              <h3 className="section-title">Goal Specific Information</h3>
              <div className="fields-grid">
                {conditionalFields.map(renderField)}
              </div>
            </>
          )}

          {/* Error Display */}
          {errors.general && (
            <div className="error-message">
              {errors.general}
            </div>
          )}

          {/* Form Actions */}
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

      {/* Streaming Section */}
      {currentStep === 'streaming' && (
        <div className="streaming-section">
          <h3 className="section-title">SIP Calculation in Progress</h3>
          
          {/* Current Agent Display */}
          {currentAgent && (
            <div className="current-agent">
              <div className="agent-spinner"></div>
              <div className="agent-info">
                <h4>Currently Processing</h4>
                <p>{formatAgentName(currentAgent)}</p>
              </div>
            </div>
          )}
          
          {/* Streaming Logs */}
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

      {/* Results Section */}
      {currentStep === 'results' && (
        <div className="results-section">
          <h3 className="section-title">Your SIP Goal Calculation Report</h3>
          
          {/* HTML Report Display */}
          {htmlReportContent && (
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
          
          {/* Summary Cards (fallback if no HTML report) */}
          {calculationResult && !htmlReportContent && (
            <>
              {/* Generated File Display */}
              {(generatedFilePath || generatedFileName) && (
                <div className="generated-file-result">
                  <label className="form-label">Generated Report File:</label>
                  <div className="file-display">
                    <input 
                      type="text" 
                      value={generatedFilePath || generatedFileName} 
                      readOnly 
                      className="form-input file-input"
                    />
                    <button className="btn-download">Open File</button>
                  </div>
                </div>
              )}
              
              <div className="results-grid">
                <div className="result-card timeline">
                  <h4>Investment Timeline</h4>
                  <p><strong>Time Horizon:</strong> {calculationResult.calculation_result.time_horizon_years} years</p>
                  <p><strong>Total Months:</strong> {calculationResult.calculation_result.total_months} months</p>
                </div>

                <div className="result-card primary">
                  <h4>Monthly SIP Amount</h4>
                  <div className="amount-large">
                    {formatCurrency(calculationResult.calculation_result.monthly_sip_amount, formData.currency)}
                  </div>
                </div>

                <div className="result-card summary">
                  <h4>Investment Summary</h4>
                  <p><strong>Total Investment:</strong> {formatCurrency(calculationResult.calculation_result.total_investment, formData.currency)}</p>
                  <p><strong>Expected Returns:</strong> {formatCurrency(calculationResult.calculation_result.expected_returns, formData.currency)}</p>
                  <p><strong>Target Amount:</strong> {formatCurrency(formData.target_amount_min, formData.currency)}</p>
                </div>

                <div className="result-card scenarios">
                  <h4>Risk Scenarios</h4>
                  <p><strong>Conservative:</strong> {formatCurrency(calculationResult.calculation_result.risk_adjusted_returns.conservative, formData.currency)}</p>
                  <p><strong>Optimistic:</strong> {formatCurrency(calculationResult.calculation_result.risk_adjusted_returns.optimistic, formData.currency)}</p>
                  <p><strong>Pessimistic:</strong> {formatCurrency(calculationResult.calculation_result.risk_adjusted_returns.pessimistic, formData.currency)}</p>
                </div>
              </div>
            </>
          )}

          <div className="form-actions">
            <button 
              onClick={handlePrevious}
              className="btn-secondary"
            >
              Previous
            </button>
            
            {/* Fund Recommendation Button */}
            {reportPathForRecommendation && (
              <button 
                onClick={() => handleFundRecommendation(reportPathForRecommendation)}
                className="btn-primary"
              >
                Get Fund Recommendations
              </button>
            )}
            
            <button 
              onClick={handleStartOver}
              className="btn-primary"
            >
              New SIP Calculation
            </button>
          </div>
        </div>
      )}

      {/* Fund Recommendation Section */}
      {currentStep === 'fund_recommendation' && (
        <div className="fund-recommendation-section">
          <h3 className="section-title">Fund Recommendations</h3>
          
          <div className="recommendation-content">
            <div className="report-path-display">
              <h4>Based on Report:</h4>
              <p className="report-path">{reportPathForRecommendation}</p>
            </div>
            
            <div className="recommendation-placeholder">
              <p>Fund recommendation functionality will be implemented here.</p>
              <p>This section will analyze your SIP report and provide personalized fund recommendations.</p>
              
              {/* You can implement fund recommendation logic here */}
              <div className="fund-categories">
                <h4>Recommended Fund Categories:</h4>
                <ul>
                  <li>Large Cap Equity Funds</li>
                  <li>Mid Cap Equity Funds</li>
                  <li>Debt Funds</li>
                  <li>Hybrid Funds</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button 
              onClick={handlePrevious}
              className="btn-secondary"
            >
              Back to Results
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

      <style>{`
        .sip-form-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .progress-indicator {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 40px;
          gap: 20px;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0.5;
          transition: opacity 0.3s;
        }

        .step.active {
          opacity: 1;
        }

        .step-number {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          margin-bottom: 8px;
        }

        .step.active .step-number {
          background: #3b82f6;
          color: white;
        }

        .step-label {
          font-size: 0.9rem;
          color: #6b7280;
        }

        .form-section, .results-section, .validation-section, .fund-recommendation-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .streaming-section {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 1px solid #bae6fd;
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
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

        .error-message {
          background: #fee2e2;
          color: #dc2626;
          padding: 15px 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          border: 1px solid #fecaca;
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

        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .result-card {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 25px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .result-card.primary {
          background: rgba(255, 255, 255, 0.25);
          text-align: center;
        }

        .result-card h4 {
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 15px;
          color: #f8fafc;
        }

        .result-card p {
          margin: 8px 0;
          color: #e2e8f0;
        }

        .amount-large {
          font-size: 2.5rem;
          font-weight: bold;
          color: #10b981;
          background: white;
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
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

        .fund-recommendation-section {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 1px solid #bae6fd;
        }

        .recommendation-content {
          margin-bottom: 30px;
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

        .recommendation-placeholder {
          background: white;
          padding: 30px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          text-align: center;
        }

        .fund-categories {
          margin-top: 20px;
          text-align: left;
        }

        .fund-categories h4 {
          color: #1f2937;
          margin-bottom: 10px;
        }

        .fund-categories ul {
          color: #374151;
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
          
          .results-grid {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .progress-indicator {
            flex-wrap: wrap;
            gap: 10px;
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
        }
      `}</style>
    </div>
  );
};

export default SIPGoalPlanningForm;