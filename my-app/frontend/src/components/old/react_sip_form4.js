import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
  const [currentStep, setCurrentStep] = useState('form'); // 'form', 'validation', 'results'

  // Load initial configuration and preserve in session
  useEffect(() => {
    const loadInitialConfig = async () => {
      try {
        // Check if config exists in sessionStorage
        const cachedConfig = sessionStorage.getItem('sip_form_config');
        if (cachedConfig) {
          const config = JSON.parse(cachedConfig);
          setFormConfig(config.formConfig);
          console.log('✅ Loaded configuration from session storage');
          return;
        }

        // Fetch from API if not in session
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/form-config`);
        setFormConfig(response.data.formConfig);
        
        // Store in session storage
        sessionStorage.setItem('sip_form_config', JSON.stringify(response.data));
        console.log('✅ Loaded and cached configuration from API');
        
      } catch (error) {
        console.error('❌ Error loading form config:', error);
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
        const response = await axios.get(`${API_BASE_URL}/form-config/${formData.goal_type}`);
        setConditionalFields(response.data.conditional_fields || []);
        
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
        
        console.log(`✅ Loaded conditional fields for ${formData.goal_type}`);
        
      } catch (error) {
        console.error('❌ Error loading conditional fields:', error);
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
      
      const response = await axios.post(`${API_BASE_URL}/validate-form`, formData);
      
      if (response.data.valid) {
        setValidationResult(response.data);
        setCurrentStep('validation');
        console.log('✅ Form validation successful');
      } else {
        setErrors({ general: response.data.message });
      }
      
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message;
      setErrors({ general: `Validation failed: ${errorMessage}` });
      console.error('❌ Validation error:', error);
    } finally {
      setValidationLoading(false);
    }
  };

  // Calculate SIP plan
  const handleCalculation = async () => {
    try {
      setLoading(true);
      setErrors({});
      
      const response = await axios.post(`${API_BASE_URL}/calculate-sip-stream`, formData);
      console.log(response)
      if (response.data.success) {
        setCalculationResult(response.data);
        setCurrentStep('results');
        console.log('✅ SIP calculation successful');
      } else {
        setErrors({ general: 'Calculation failed' });
      }
      
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message;
      setErrors({ general: `Calculation failed: ${errorMessage}` });
      console.error('❌ Calculation error:', error);
    } finally {
      setLoading(false);
    }
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
      {/* Header */}
      <div className="form-header">
        <h1 className="form-title">{formConfig.title}</h1>
        <p className="form-description">{formConfig.description}</p>
      </div>

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
        <div className={`step ${currentStep === 'results' ? 'active' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">Results</span>
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
              onClick={handleValidation}
              disabled={validationLoading || !isFormComplete()}
              className="btn-primary"
            >
              {validationLoading ? 'Validating...' : 'Validate Form'}
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
              ✅ Form validation successful!
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
              onClick={() => setCurrentStep('form')}
              className="btn-secondary"
            >
              Back to Form
            </button>
            <button 
              onClick={handleCalculation}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Calculating...' : 'Calculate SIP Plan'}
            </button>
          </div>
        </div>
      )}

      {/* Results Section */}
      {currentStep === 'results' && calculationResult && (
        <div className="results-section">
          <h3 className="section-title">Your SIP Calculation Results</h3>
          
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

          <div className="form-actions">
            <button 
              onClick={() => setCurrentStep('validation')}
              className="btn-secondary"
            >
              Back to Validation
            </button>
            <button 
              onClick={handleStartOver}
              className="btn-primary"
            >
              Start New Calculation
            </button>
          </div>
        </div>
      )}

      {/* JSON Debug Section (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-section">
          <details>
            <summary>Debug: Form Data JSON</summary>
            <pre>{JSON.stringify(formData, null, 2)}</pre>
          </details>
        </div>
      )}

      <style jsx>{`
        .sip-form-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .form-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .form-title {
          font-size: 2.5rem;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 10px;
        }

        .form-description {
          color: #6b7280;
          font-size: 1.1rem;
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

        .form-section, .results-section {
          background: white;
          border: 1px solid #e5e7eb;
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

        .btn-primary, .btn-secondary {
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

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .validation-section {
          background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
        }

        .validation-success {
          background: #dcfce7;
          color: #15803d;
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

        .debug-section {
          margin-top: 40px;
          padding: 20px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .debug-section pre {
          background: #1f2937;
          color: #f3f4f6;
          padding: 15px;
          border-radius: 6px;
          overflow-x: auto;
          font-size: 0.875rem;
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
            flex-direction: row;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default SIPGoalPlanningForm;
