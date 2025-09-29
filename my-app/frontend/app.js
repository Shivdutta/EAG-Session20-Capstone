// Chat Application JavaScript
class ChatApp {
    constructor() {
        this.chatMessages = document.getElementById('chat-messages');
        this.chatForm = document.getElementById('chat-form');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.isProcessing = false;
        this.statusPollingInterval = null;
        this.fileInput = document.getElementById('file-input');
        this.attachBtn = document.getElementById('attach-btn');
        this.fileIndicator = null;
        
        this.initializeEventListeners();
        this.autoResizeTextarea();
    }

    initializeEventListeners() {
        // Form submission
        this.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Enter key handling
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Starter prompt buttons
        document.querySelectorAll('.prompt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.getAttribute('data-prompt');
                this.messageInput.value = prompt;
                this.messageInput.focus();
            });
        });

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        // Header action buttons
        document.querySelector('.btn-icon[title="Clear Conversation"]').addEventListener('click', () => {
            this.clearChat();
        });

        document.querySelector('.btn-icon[title="Export Chat"]').addEventListener('click', () => {
            this.exportChat();
        });

        if (this.attachBtn && this.fileInput) {
            this.attachBtn.addEventListener('click', () => {
                this.fileInput.click();
            });
        }
        if (this.fileInput) {
            this.fileInput.addEventListener('change', () => {
                this.showFileIndicator();
            });
        }
    }

    autoResizeTextarea() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isProcessing) return;

        // Add user message to chat
        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.autoResizeTextarea();

        // Show agent processing placeholder with timer
        const agentProcessingDiv = this.showAgentProcessingPlaceholder();

        // Disable input during processing
        this.setProcessingState(true);

        // Start polling for status updates
        this.startStatusPolling();

        try {
            // Use FormData for file upload
            const formData = new FormData();
            formData.append('question', message);
            if (this.fileInput && this.fileInput.files.length > 0) {
                for (let i = 0; i < this.fileInput.files.length; i++) {
                    formData.append('files', this.fileInput.files[i]);
                }
            }
            const apiResponse = await this.callAPI(formData);
            this.removeAgentProcessingPlaceholder(agentProcessingDiv);
            //let agentMsg = apiResponse.response || 'I apologize, but I didn\'t receive a response from the system. Please try again.';
            //start
            let agentMsg = apiResponse?.response;
            if (agentMsg === null || agentMsg === undefined) {
                agentMsg = 'I apologize, but I didn\'t receive a response from the system. Please try again.';
            } else if (typeof agentMsg !== 'string') {
                try { agentMsg = JSON.stringify(agentMsg); } catch { agentMsg = String(agentMsg); }
            }
            //end
            // --- NEW: Display analysis if present ---
            if (apiResponse && typeof apiResponse === 'object' && apiResponse.analysis) {
                agentMsg += this.formatAnalysis(apiResponse.analysis);
            }
            this.addMessage(agentMsg, 'agent');
            if (this.fileInput) this.fileInput.value = '';
            this.clearFileIndicator();
        } catch (error) {
            this.removeAgentProcessingPlaceholder(agentProcessingDiv);
            const errText = (error && error.message) ? error.message : String(error);
+           this.addMessage(`Request failed: ${errText}`, 'agent');
+           console.error('API Error:', error);
        } finally {
            this.setProcessingState(false);
            setTimeout(() => this.stopStatusPolling(), 10000);
        }
    }

    addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-${sender === 'user' ? 'user' : 'brain'}"></i>
            </div>
            <div class="message-content">
                <div class="message-text">
                    ${this.formatMessage(content)}
                </div>
                <div class="message-time">${timestamp}</div>
            </div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatMessage(content) {
        // Convert URLs to links
        content = content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Convert line breaks to <br> tags
        content = content.replace(/\n/g, '<br>');
        
        // Convert markdown-style code blocks
        content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        
        // Convert inline code
        content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        return content;
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message agent-message typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-brain"></i>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
        return typingDiv;
    }

    hideTypingIndicator(typingIndicator) {
        if (typingIndicator && typingIndicator.parentNode) {
            typingIndicator.remove();
        }
    }

    setProcessingState(processing) {
        this.isProcessing = processing;
        this.sendBtn.disabled = processing;
        this.messageInput.disabled = processing;
        
        if (processing) {
            this.sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        } else {
            this.sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }

    async callAPI(formData) {
        try {
            const response = await fetch('/ask', { // CHANGED: use relative URL
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const txt = await response.text().catch(()=> '');
                throw new Error(`HTTP ${response.status}: ${txt || 'Server error'}`);
            }

            const data = await response.json();
            return data; // Return the full response object
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    clearChat() {
        if (confirm('Clear conversation history?')) {
            const welcomeMessage = this.chatMessages.querySelector('.agent-message');
            const starterPrompts = this.chatMessages.querySelector('.starter-prompts');
            
            this.chatMessages.innerHTML = '';
            
            if (welcomeMessage) {
                this.chatMessages.appendChild(welcomeMessage);
            }
            if (starterPrompts) {
                this.chatMessages.appendChild(starterPrompts);
            }
        }
    }

    exportChat() {
        const messages = this.chatMessages.querySelectorAll('.message:not(.typing-indicator)');
        let exportText = 'EAG18 Conversation Export\n';
        exportText += '==========================\n\n';
        
        messages.forEach(message => {
            const isUser = message.classList.contains('user-message');
            const content = message.querySelector('.message-text').textContent;
            const time = message.querySelector('.message-time').textContent;
            
            exportText += `[${time}] ${isUser ? 'You' : 'EAG18'}: ${content}\n\n`;
        });
        
        const blob = new Blob([exportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eag18-conversation-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    startStatusPolling() {
        if (this.statusPollingInterval) return;
        this.statusPollingInterval = setInterval(() => this.fetchAgentStatus(), 1000);
        this.fetchAgentStatus(); // Initial fetch
    }

    stopStatusPolling() {
        if (this.statusPollingInterval) {
            clearInterval(this.statusPollingInterval);
            this.statusPollingInterval = null;
        }
    }

    async fetchAgentStatus() {
        try {
            const response = await fetch('/status'); // CHANGED: use relative URL
            if (!response.ok) throw new Error('Failed to fetch agent status');
            const status = await response.json();
            this.updateAgentStatus(status);
        } catch (e) {
            // Optionally handle error
        }
    }

    updateAgentStatus(status) {
        const sidebar = document.querySelector('.right-sidebar .sidebar-content');
        if (!sidebar) return;
        let html = '';

        if (status.status === 'starting') {
            html = `
                <div class="dag-node running" style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:8px;">
                    <span style="font-size:15px;flex-shrink:0;">🔄</span>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span class="dag-agent-name" style="font-weight:600;font-size:13px;color:#0f172a;letter-spacing:0.01em;">Agent</span>
                            <span class="dag-status-pill" style="display:inline-block; min-width:60px; padding:2px 10px; border-radius:12px; font-size:11px; font-weight:600; background:#e0f2fe; color:#2563eb; margin-left:8px; vertical-align:middle; letter-spacing:0.02em;">Planning</span>
                        </div>
                        <div class="dag-desc" style="font-size:12px;color:#64748b;margin-top:2px;line-height:1.4;">Preparing agent and planning steps...</div>
                    </div>
                </div>
            `;
        } else if (status.plan && status.plan.length > 0) {
            // Build a map of node id to node for quick lookup
            const nodeMap = {};
            status.plan.forEach(n => nodeMap[n.id] = n);
            // Build a map of node id to children for edge rendering
            const childMap = {};
            if (status.edges) {
                status.edges.forEach(e => {
                    if (!childMap[e.source]) childMap[e.source] = [];
                    childMap[e.source].push(e.target);
                });
            }
            // Helper for status pill
            function statusPill(nodeStatus) {
                let color = '#64748b', bg = '#f3f4f6', text = 'Pending';
                if (nodeStatus === 'completed') { color = '#15803d'; bg = '#dcfce7'; text = 'Completed'; }
                else if (nodeStatus === 'running') { color = '#2563eb'; bg = '#e0f2fe'; text = 'Running'; }
                else if (nodeStatus === 'failed') { color = '#b91c1c'; bg = '#fee2e2'; text = 'Failed'; }
                return `<span class="dag-status-pill" style="display:inline-block; min-width:60px; padding:2px 10px; border-radius:12px; font-size:11px; font-weight:600; background:${bg}; color:${color}; margin-left:8px; vertical-align:middle; letter-spacing:0.02em;">${text}</span>`;
            }
            // Render nodes in order (topological or as given)
            html += '<div class="dag-plan-list">';
            status.plan.forEach(node => {
                let icon = '⏳', nodeClass = 'pending';
                if (node.status === 'completed') { icon = '✅'; nodeClass = 'completed'; }
                else if (node.status === 'running') { icon = '🔄'; nodeClass = 'running'; }
                else if (node.status === 'failed') { icon = '❌'; nodeClass = 'failed'; }
                html += `
                    <div class="dag-node ${nodeClass}" style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:15px;flex-shrink:0;">${icon}</span>
                        <div style="flex:1;min-width:0;">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <span class="dag-agent-name" style="font-weight:600;font-size:13px;color:#0f172a;letter-spacing:0.01em;">${node.agent}</span>
                                ${statusPill(node.status)}
                            </div>
                            <div class="dag-desc" style="font-size:12px;color:#64748b;margin-top:2px;line-height:1.4;">${node.description}</div>
                        </div>
                    </div>
                `;
                // Draw arrow if this node has children (for minimal vertical DAG look)
                if (childMap[node.id] && childMap[node.id].length > 0) {
                    html += `<div class="dag-arrow" style="margin-left:22px;margin-bottom:-2px;font-size:12px;color:#cbd5e1;">↓</div>`;
                }
            });
            html += '</div>';
            // Progress bar and time
            if (status.progress) {
                html += `<div style="margin-top:12px;font-size:12px;color:#64748b;display:flex;align-items:center;gap:10px;">
                    <span>Progress:</span>
                    <span style="font-weight:600;color:#2563eb;">${status.progress.completed}/${status.progress.total}</span>
                    <span style="margin-left:auto;">⏱️ ${status.execution_time || 0}s</span>
                </div>`;
            }
        } else {
            html = `<div style="padding: 12px; color: #64748b; font-size: 13px;">No plan available.</div>`;
        }
        sidebar.innerHTML = html;
    }

    showAgentProcessingPlaceholder() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message agent-message agent-processing-placeholder';
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-brain"></i>
            </div>
            <div class="message-content">
                <div class="message-text" style="display:flex;align-items:center;gap:10px;">
                    <span class="processing-timer" style="display:inline-block;width:18px;height:18px;vertical-align:middle;">
                        <i class='fas fa-clock fa-spin' style='color:#3b82f6;font-size:16px;'></i>
                    </span>
                    <span>Agent is processing your request...</span>
                    <span class="processing-elapsed" style="font-size:12px;color:#64748b;margin-left:4px;min-width:32px;">(0s)</span>
                </div>
                <div class="message-text" style="font-size:12px;color:#2563eb;margin-top:4px;background:#f1f5f9;border-radius:6px;padding:6px 10px;display:inline-block;max-width:90%;">
                    <i class="fas fa-info-circle" style="margin-right:5px;"></i>View live agent plan and progress in the <b>right pane</b>.
                </div>
                <div class="message-time">${timestamp}</div>
            </div>
        `;
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        // Start timer animation
        let seconds = 0;
        messageDiv._timerInterval = setInterval(() => {
            seconds++;
            const elapsed = messageDiv.querySelector('.processing-elapsed');
            if (elapsed) elapsed.textContent = `(${seconds}s)`;
        }, 1000);
        return messageDiv;
    }

    removeAgentProcessingPlaceholder(placeholderDiv) {
        if (placeholderDiv && placeholderDiv.parentNode) {
            // Stop timer animation
            if (placeholderDiv._timerInterval) clearInterval(placeholderDiv._timerInterval);
            placeholderDiv.remove();
        }
    }

    showFileIndicator() {
        // Remove old indicator
        if (this.fileIndicator && this.fileIndicator.parentNode) {
            this.fileIndicator.parentNode.removeChild(this.fileIndicator);
        }
        if (!this.fileInput || this.fileInput.files.length === 0) return;
        // Create new indicator
        const indicator = document.createElement('div');
        indicator.className = 'file-indicator';
        indicator.style = 'margin: 6px 0 0 0; display: flex; flex-wrap: wrap; gap: 6px;';
        for (let i = 0; i < this.fileInput.files.length; i++) {
            const file = this.fileInput.files[i];
            const chip = document.createElement('span');
            chip.className = 'file-chip';
            chip.style = 'background: #e0e7ef; color: #334155; border-radius: 12px; padding: 3px 10px; font-size: 12px; display: flex; align-items: center; gap: 4px;';
            chip.innerHTML = `<i class='fas fa-file'></i> ${file.name}`;
            indicator.appendChild(chip);
        }
        // Insert below the input-wrapper
        const inputWrapper = this.chatForm.querySelector('.input-wrapper');
        if (inputWrapper && inputWrapper.parentNode) {
            inputWrapper.parentNode.insertBefore(indicator, inputWrapper.nextSibling);
        }
        this.fileIndicator = indicator;
    }

    clearFileIndicator() {
        if (this.fileIndicator && this.fileIndicator.parentNode) {
            this.fileIndicator.parentNode.removeChild(this.fileIndicator);
            this.fileIndicator = null;
        }
    }

    // --- NEW: Format analysis for chat display ---
    formatAnalysis(analysis) {
        if (!analysis || typeof analysis !== 'object') return '';
        let html = '<div class="agent-analysis-block">';
        // Execution Summary
        if (analysis.execution_summary) {
            html += '<div class="agent-analysis-section"><b>Execution Summary:</b><ul>';
            for (const [k, v] of Object.entries(analysis.execution_summary)) {
                html += `<li><b>${this.capitalize(k)}:</b> ${this.truncateText(String(v), 200)}</li>`;
            }
            html += '</ul></div>';
        }
        // Steps
        if (Array.isArray(analysis.steps) && analysis.steps.length > 0) {
            html += '<div class="agent-analysis-section"><b>Steps:</b><ul>';
            for (const step of analysis.steps) {
                html += '<li>';
                for (const [k, v] of Object.entries(step)) {
                    html += `<b>${this.capitalize(k)}:</b> ${this.truncateText(String(v), 200)}; `;
                }
                html += '</li>';
            }
            html += '</ul></div>';
        }
        // Session
        if (analysis.session) {
            html += '<div class="agent-analysis-section"><b>Session:</b><ul>';
            for (const [k, v] of Object.entries(analysis.session)) {
                html += `<li><b>${this.capitalize(k)}:</b> ${this.truncateText(String(v), 200)}</li>`;
            }
            html += '</ul></div>';
        }
        // Cost Breakdown
        if (Array.isArray(analysis.cost_breakdown) && analysis.cost_breakdown.length > 0) {
            html += '<div class="agent-analysis-section"><b>Cost Breakdown:</b><ul>';
            for (const cost of analysis.cost_breakdown) {
                html += '<li>';
                for (const [k, v] of Object.entries(cost)) {
                    html += `<b>${this.capitalize(k)}:</b> ${this.truncateText(String(v), 200)}; `;
                }
                html += '</li>';
            }
            html += '</ul></div>';
        }
        html += '</div>';
        return html;
    }

    // --- NEW: Helper to truncate text to 200 words ---
    truncateText(text, maxWords) {
        const words = text.split(/\s+/);
        if (words.length <= maxWords) return text;
        return words.slice(0, maxWords).join(' ') + '...';
    }

    // --- NEW: Capitalize helper ---
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
    }
}

let knownSidebarFiles = { reports: new Set(), code: {}, sessions: new Set() };

async function loadSidebarFiles() {
    const sidebar = document.getElementById('left-sidebar-content');
    if (!sidebar) return;

    // Fetch reports (with mtime)
    let reports = [];
    try {
        const res = await fetch('/list-reports');
        const data = await res.json();
        reports = data.reports || [];
    } catch {}

    // Fetch code outputs (with mtime)
    let sessions = [];
    try {
        const res = await fetch('/list-code-outputs');
        const data = await res.json();
        sessions = data.sessions || [];
    } catch {}

    // Sort reports by mtime descending
    reports.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

    // Sort sessions by most recent file mtime
    sessions.sort((a, b) => {
        const aMaxMtime = Math.max(...a.files.map(f => f.mtime || 0));
        const bMaxMtime = Math.max(...b.files.map(f => f.mtime || 0));
        return bMaxMtime - aMaxMtime;
    });

    // Sort files in each session by mtime descending
    for (const session of sessions) {
        session.files.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    }

    // Track new files
    let newReports = new Set();
    let newCodeFiles = {};
    let newSessions = new Set();
    if (knownSidebarFiles.reports.size > 0) {
        for (const r of reports.map(r => r.path || r)) {
            if (!knownSidebarFiles.reports.has(r)) newReports.add(r);
        }
    }
    if (Object.keys(knownSidebarFiles.code).length > 0) {
        for (const session of sessions) {
            newCodeFiles[session.session] = new Set();
            if (!knownSidebarFiles.sessions.has(session.session)) {
                newSessions.add(session.session);
            }
            for (const file of session.files.map(f => f.path || f)) {
                if (!knownSidebarFiles.code[session.session] || !knownSidebarFiles.code[session.session].has(file)) {
                    newCodeFiles[session.session].add(file);
                }
            }
        }
    }

    // Render reports section
    let html = '<div class="sidebar-sections-flex">';
    html += '<div class="sidebar-section sidebar-section-half sidebar-section-reports">';
    html += '<h4><i class="fas fa-file-alt"></i> Reports</h4>';
    if (reports.length === 0) {
        html += '<div class="sidebar-empty">No reports found.</div>';
    } else {
        html += '<div class="sidebar-card-grid">';
        for (const report of reports) {
            const path = report.path || report;
            const isNew = newReports.has(path);
            html += `
              <div class="sidebar-card">
                <div class="sidebar-card-icon"><i class="fas fa-file-alt"></i></div>
                <div class="sidebar-card-content">
                  <a href="/memory/${path}" target="_blank">${path.split('/').pop()}</a>
                  ${isNew ? '<span class="file-badge-new">NEW</span>' : ''}
                </div>
              </div>
            `;
        }
        html += '</div>';
    }
    html += '</div>';

    // Render code outputs section with card-based layout
    html += '<div class="sidebar-section sidebar-section-half sidebar-section-code">';
    html += '<h4><i class="fas fa-code"></i> Generated Files</h4>';
    if (sessions.length === 0) {
        html += '<div class="sidebar-empty">No generated files found.</div>';
    } else {
        html += '<div class="sidebar-card-grid">';
        for (const session of sessions) {
            const sessionDate = new Date(Math.max(...session.files.map(f => f.mtime * 1000))).toLocaleDateString();
            const isNewSession = newSessions.has(session.session);
            const hasNewFiles = newCodeFiles[session.session] && newCodeFiles[session.session].size > 0;
            
            html += `<div class="sidebar-card sidebar-card-folder" data-session="${session.session}">
                <div class="sidebar-card-icon">
                    <i class="fas fa-folder${isNewSession ? '-plus' : ''}"></i>
                    ${isNewSession ? '<span class="folder-badge-new">NEW</span>' : ''}
                </div>
                <div class="sidebar-card-content">
                    <div class="folder-header" onclick="toggleFolder('${session.session}')">
                        <span class="folder-title">Session ${session.session}</span>
                        <span class="folder-date">${sessionDate}</span>
                        <i class="fas fa-chevron-down folder-toggle" id="toggle-${session.session}"></i>
                    </div>
                    <div class="folder-files" id="files-${session.session}" style="display: none;">
                        <div class="folder-files-grid">`;
            
            for (const file of session.files) {
                const path = file.path || file;
                const isNew = newCodeFiles[session.session] && newCodeFiles[session.session].has(path);
                const fileExt = path.split('.').pop().toLowerCase();
                const iconClass = getFileIcon(fileExt);
                
                html += `<div class="folder-file-item">
                    <div class="folder-file-icon">
                        <i class="${iconClass}"></i>
                        ${isNew ? '<span class="file-badge-new">NEW</span>' : ''}
                    </div>
                    <div class="folder-file-content">
                        <a href="/media/generated/${session.session}/${path}" target="_blank" title="View ${path}">${path}</a>
                        <button class="file-preview-btn" onclick="previewFile('${session.session}', '${path}')" title="Preview ${path}">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>`;
            }
            
            html += `</div></div>
                </div>
            </div>`;
        }
        html += '</div>';
    }
    html += '</div>';
    html += '</div>';

    sidebar.innerHTML = html;

    // Update known files for next refresh
    knownSidebarFiles.reports = new Set(reports.map(r => r.path || r));
    knownSidebarFiles.code = {};
    knownSidebarFiles.sessions = new Set();
    for (const session of sessions) {
        knownSidebarFiles.code[session.session] = new Set(session.files.map(f => f.path || f));
        knownSidebarFiles.sessions.add(session.session);
    }
}

// Helper function to get appropriate icon for file type
function getFileIcon(fileExt) {
    const iconMap = {
        'html': 'fas fa-file-code',
        'css': 'fas fa-file-code',
        'js': 'fas fa-file-code',
        'py': 'fas fa-file-code',
        'json': 'fas fa-file-code',
        'xml': 'fas fa-file-code',
        'txt': 'fas fa-file-alt',
        'md': 'fas fa-file-alt',
        'zip': 'fas fa-file-archive',
        'png': 'fas fa-file-image',
        'jpg': 'fas fa-file-image',
        'jpeg': 'fas fa-file-image',
        'gif': 'fas fa-file-image',
        'svg': 'fas fa-file-image',
        'pdf': 'fas fa-file-pdf',
        'csv': 'fas fa-file-csv',
        'xlsx': 'fas fa-file-excel',
        'xls': 'fas fa-file-excel'
    };
    return iconMap[fileExt] || 'fas fa-file';
}

// File preview functionality
async function previewFile(sessionId, filename) {
    try {
        const response = await fetch(`/media/generated/${sessionId}/${filename}`);
        if (!response.ok) {
            throw new Error('File not found');
        }
        
        const content = await response.text();
        const fileExt = filename.split('.').pop().toLowerCase();
        
        // Create modal for file preview
        const modal = document.createElement('div');
        modal.className = 'file-preview-modal';
        modal.innerHTML = `
            <div class="file-preview-content">
                <div class="file-preview-header">
                    <h3><i class="${getFileIcon(fileExt)}"></i> ${filename}</h3>
                    <button onclick="closeFilePreview()" class="close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="file-preview-body">
                    <pre><code>${escapeHtml(content)}</code></pre>
                </div>
                <div class="file-preview-footer">
                    <a href="/media/generated/${sessionId}/${filename}" target="_blank" class="btn-secondary">
                        <i class="fas fa-external-link-alt"></i> Open in New Tab
                    </a>
                    <button onclick="closeFilePreview()" class="btn-primary">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error previewing file:', error);
        alert('Error loading file preview');
    }
}

function closeFilePreview() {
    const modal = document.querySelector('.file-preview-modal');
    if (modal) {
        modal.remove();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize knownSidebarFiles if not exists
if (typeof knownSidebarFiles === 'undefined') {
    knownSidebarFiles = {
        reports: new Set(),
        code: {},
        sessions: new Set()
    };
}

// Toggle folder function
function toggleFolder(sessionId) {
    const filesDiv = document.getElementById(`files-${sessionId}`);
    const toggleIcon = document.getElementById(`toggle-${sessionId}`);
    
    if (filesDiv.style.display === 'none') {
        filesDiv.style.display = 'block';
        toggleIcon.className = 'fas fa-chevron-up folder-toggle';
    } else {
        filesDiv.style.display = 'none';
        toggleIcon.className = 'fas fa-chevron-down folder-toggle';
    }
}

// Initialize the chat application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
    loadSidebarFiles();
    setInterval(loadSidebarFiles, 10000); // Refresh every 10 seconds
});

// Add sophisticated CSS for code blocks and links
const style = document.createElement('style');
style.textContent = `
    .message-text pre {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 8px;
        padding: 16px;
        margin: 12px 0;
        overflow-x: auto;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.5;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    
    .message-text code {
        background: rgba(148, 163, 184, 0.1);
        border: 1px solid rgba(148, 163, 184, 0.2);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        font-size: 13px;
        color: #334155;
    }
    
    .message-text a {
        color: #3b82f6;
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: all 0.2s ease;
        font-weight: 500;
    }
    
    .message-text a:hover {
        color: #2563eb;
        border-bottom-color: #3b82f6;
    }
    
    .user-message .message-text a {
        color: rgba(255, 255, 255, 0.9);
        border-bottom-color: rgba(255, 255, 255, 0.5);
    }
    
    .user-message .message-text a:hover {
        color: #ffffff;
        border-bottom-color: rgba(255, 255, 255, 0.8);
    }
    
    .user-message .message-text code {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
        color: #ffffff;
    }
    
    .user-message .message-text pre {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        color: #ffffff;
    }
`;
document.head.appendChild(style);
