// Client Dashboard JavaScript
let clientId = null;
let clientData = null;
let charts = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Get client ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    clientId = urlParams.get('id');
    
    if (!clientId) {
        window.location.href = '/clients.html';
        return;
    }
    
    loadClientData();
    setupEventListeners();
    initializeCharts();
});

function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const tabName = e.currentTarget.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Chat form
    document.getElementById('chatForm').addEventListener('submit', handleChatSubmit);
    
    // Quick prompts
    document.querySelectorAll('.quick-prompt').forEach(button => {
        button.addEventListener('click', (e) => {
            const prompt = e.target.textContent.trim();
            document.getElementById('chatInput').value = prompt;
            handleChatSubmit(e);
        });
    });
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        if (button.dataset.tab === tabName) {
            button.classList.add('active', 'bg-blue-600', 'text-white');
            button.classList.remove('text-gray-700');
        } else {
            button.classList.remove('active', 'bg-blue-600', 'text-white');
            button.classList.add('text-gray-700');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === tabName) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
    
    // Load tab-specific data if needed
    switch (tabName) {
        case 'content':
            loadContentPlans();
            break;
        case 'social':
            loadSocialMedia();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'integrations':
            loadIntegrations();
            break;
        case 'documents':
            loadDocuments();
            break;
    }
}

async function loadClientData() {
    try {
        // In production, this would fetch from the API
        // For demo, using mock data
        clientData = {
            id: clientId,
            name: 'Acme Corporation',
            domain: 'https://acme.com',
            status: 'active',
            metrics: {
                revenue: 2500000,
                revenue_change: 12.5,
                leads: 1234,
                leads_change: 8.3,
                conversion: 24.5,
                conversion_change: -2.1,
                campaigns: 5
            }
        };
        
        updateClientHeader();
    } catch (error) {
        console.error('Error loading client data:', error);
    }
}

function updateClientHeader() {
    document.getElementById('clientName').textContent = clientData.name;
    document.getElementById('clientDomain').textContent = clientData.domain;
}

function initializeCharts() {
    // Revenue Chart
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    charts.revenue = new Chart(revenueCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Revenue',
                data: [180000, 195000, 210000, 225000, 240000, 250000],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000) + 'k';
                        }
                    }
                }
            }
        }
    });
    
    // Lead Sources Chart
    const leadSourcesCtx = document.getElementById('leadSourcesChart').getContext('2d');
    charts.leadSources = new Chart(leadSourcesCtx, {
        type: 'doughnut',
        data: {
            labels: ['Organic', 'Paid Search', 'Social Media', 'Email', 'Direct'],
            datasets: [{
                data: [35, 25, 20, 15, 5],
                backgroundColor: [
                    '#3b82f6',
                    '#10b981',
                    '#f59e0b',
                    '#8b5cf6',
                    '#6b7280'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

async function handleChatSubmit(e) {
    e.preventDefault();
    
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addChatMessage('user', message);
    
    // Clear input
    input.value = '';
    
    // Show typing indicator
    const typingId = addTypingIndicator();
    
    try {
        // Simulate API call to RevOps swarm
        const response = await simulateSwarmResponse(message);
        
        // Remove typing indicator
        removeTypingIndicator(typingId);
        
        // Add swarm response
        addChatMessage('swarm', response.message, response.agents);
    } catch (error) {
        removeTypingIndicator(typingId);
        addChatMessage('error', 'Sorry, I encountered an error. Please try again.');
    }
}

function addChatMessage(type, message, agents = []) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    if (type === 'user') {
        messageDiv.innerHTML = `
            <div class="flex justify-end mb-4">
                <div class="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-xs lg:max-w-md">
                    <p class="text-sm">${message}</p>
                </div>
            </div>
        `;
    } else if (type === 'swarm') {
        messageDiv.innerHTML = `
            <div class="flex items-start mb-4">
                <div class="bg-gray-100 p-2 rounded-lg mr-3">
                    <i class="fas fa-robot text-gray-600"></i>
                </div>
                <div class="flex-1">
                    <div class="bg-white border border-gray-200 rounded-lg px-4 py-3 max-w-xs lg:max-w-md">
                        <p class="text-sm text-gray-800">${message}</p>
                        ${agents.length > 0 ? `
                            <div class="mt-2 pt-2 border-t border-gray-200">
                                <p class="text-xs text-gray-500">Agents involved: ${agents.join(', ')}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'error') {
        messageDiv.innerHTML = `
            <div class="flex items-center justify-center mb-4">
                <div class="bg-red-100 text-red-700 rounded-lg px-4 py-2">
                    <p class="text-sm">${message}</p>
                </div>
            </div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const typingId = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = typingId;
    typingDiv.className = 'chat-message';
    typingDiv.innerHTML = `
        <div class="flex items-start mb-4">
            <div class="bg-gray-100 p-2 rounded-lg mr-3">
                <i class="fas fa-robot text-gray-600"></i>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <div class="flex space-x-2">
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return typingId;
}

function removeTypingIndicator(typingId) {
    const typingDiv = document.getElementById(typingId);
    if (typingDiv) {
        typingDiv.remove();
    }
}

async function simulateSwarmResponse(message) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
    
    // Simulate different responses based on message content
    const responses = {
        'marketing plan': {
            message: "I'll create a comprehensive marketing plan for you. Based on your current metrics and market analysis, I recommend focusing on content marketing and paid social campaigns. The CRM Agent has identified high-value segments, and the Marketing Agent has prepared a detailed strategy. Would you like me to generate the full plan document?",
            agents: ['Coordinator Agent', 'Marketing Agent', 'CRM Agent']
        },
        'competitor': {
            message: "I've analyzed your top 5 competitors. Your main advantages are superior customer service (NPS 72 vs industry avg 45) and faster implementation times. However, competitors have stronger SEO presence. The Analytics Agent suggests focusing on long-tail keywords and technical SEO improvements.",
            agents: ['Analytics Agent', 'Marketing Agent']
        },
        'lead': {
            message: "Your lead generation is performing well with a 23% MoM growth. The CRM Agent identified that webinar leads have 3x higher conversion rates. I recommend increasing webinar frequency from monthly to bi-weekly and implementing a new lead scoring model.",
            agents: ['CRM Agent', 'Analytics Agent', 'Marketing Agent']
        },
        'conversion': {
            message: "Your current conversion rate is 24.5%, which is above industry average (18%). However, the Analytics Agent found that mobile conversions are 40% lower than desktop. I recommend implementing mobile-optimized landing pages and simplified checkout process.",
            agents: ['Analytics Agent', 'CRM Agent']
        },
        default: {
            message: "I understand your request. Let me coordinate with the specialized agents to provide you with the best insights and recommendations. This may involve analyzing your data, market trends, and creating actionable strategies. What specific aspect would you like me to focus on?",
            agents: ['Coordinator Agent']
        }
    };
    
    // Find matching response
    const lowerMessage = message.toLowerCase();
    for (const [key, response] of Object.entries(responses)) {
        if (lowerMessage.includes(key)) {
            return response;
        }
    }
    
    return responses.default;
}

async function loadContentPlans() {
    // Load content and strategic plans
    const contentTypes = [
        { type: 'marketing_plan', title: 'Q1 Marketing Plan', status: 'approved', updated: '2 days ago' },
        { type: 'sales_plan', title: 'Annual Sales Strategy', status: 'draft', updated: '1 week ago' },
        { type: 'campaign', title: 'Summer Product Launch', status: 'review', updated: '3 days ago' },
        { type: 'revops_plan', title: 'RevOps Optimization Plan', status: 'approved', updated: '5 days ago' }
    ];
    
    // Update UI with content cards
}

async function loadSocialMedia() {
    // Load social media posts and analytics
}

async function loadAnalytics() {
    // Initialize additional analytics charts
    if (!charts.traffic) {
        const trafficCtx = document.getElementById('trafficChart').getContext('2d');
        charts.traffic = new Chart(trafficCtx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Visitors',
                    data: [12000, 14000, 13500, 15000],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    if (!charts.funnel) {
        const funnelCtx = document.getElementById('funnelChart').getContext('2d');
        charts.funnel = new Chart(funnelCtx, {
            type: 'bar',
            data: {
                labels: ['Visitors', 'Leads', 'MQLs', 'SQLs', 'Customers'],
                datasets: [{
                    label: 'Conversion Funnel',
                    data: [15000, 3000, 900, 450, 110],
                    backgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y'
            }
        });
    }
}

async function loadIntegrations() {
    // Load integration status and configurations
}

async function loadDocuments() {
    // Load client documents
}