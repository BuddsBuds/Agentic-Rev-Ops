// Client Onboarding JavaScript
let currentStep = 1;
const totalSteps = 7;
let onboardingData = {
    client: {},
    stakeholders: [],
    socialLinks: [],
    integrations: [],
    documents: [],
    analyses: []
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateStepDisplay();
    setupEventListeners();
    initializeStakeholderForm();
    initializeSocialLinksForm();
    initializeFileUpload();
});

function setupEventListeners() {
    // Navigation buttons
    document.getElementById('prevBtn').addEventListener('click', prevStep);
    document.getElementById('nextBtn').addEventListener('click', nextStep);
    document.getElementById('completeBtn').addEventListener('click', completeOnboarding);

    // Step navigation
    document.querySelectorAll('.step-nav').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const step = parseInt(e.currentTarget.dataset.step);
            if (step <= currentStep) {
                goToStep(step);
            }
        });
    });

    // Integration cards
    document.querySelectorAll('.integration-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const integration = e.currentTarget.dataset.integration;
            openIntegrationModal(integration);
        });
    });

    // Integration modal
    document.getElementById('cancelIntegration').addEventListener('click', closeIntegrationModal);
    document.getElementById('saveIntegration').addEventListener('click', saveIntegration);
}

function updateStepDisplay() {
    // Update progress bar
    const progress = (currentStep / totalSteps) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('currentStep').textContent = currentStep;

    // Show/hide steps
    document.querySelectorAll('.step-content').forEach((step, index) => {
        if (index + 1 === currentStep) {
            step.classList.remove('step-inactive');
            step.classList.add('step-active');
        } else {
            step.classList.remove('step-active');
            step.classList.add('step-inactive');
        }
    });

    // Update navigation buttons
    document.getElementById('prevBtn').disabled = currentStep === 1;
    
    if (currentStep === totalSteps) {
        document.getElementById('nextBtn').classList.add('hidden');
        document.getElementById('completeBtn').classList.remove('hidden');
        populateReviewSummary();
    } else {
        document.getElementById('nextBtn').classList.remove('hidden');
        document.getElementById('completeBtn').classList.add('hidden');
    }

    // Update step navigation buttons
    document.querySelectorAll('.step-nav').forEach((btn, index) => {
        if (index + 1 === currentStep) {
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-gray-200', 'text-gray-700');
        } else if (index + 1 < currentStep) {
            btn.classList.add('bg-green-100', 'text-green-700');
            btn.classList.remove('bg-gray-200', 'text-gray-700', 'bg-blue-600', 'text-white');
        } else {
            btn.classList.add('bg-gray-200', 'text-gray-700');
            btn.classList.remove('bg-blue-600', 'text-white', 'bg-green-100', 'text-green-700');
        }
    });
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateStepDisplay();
    }
}

function nextStep() {
    if (validateCurrentStep()) {
        saveCurrentStepData();
        if (currentStep < totalSteps) {
            currentStep++;
            updateStepDisplay();
        }
    }
}

function goToStep(step) {
    if (step >= 1 && step <= totalSteps && step <= currentStep) {
        currentStep = step;
        updateStepDisplay();
    }
}

function validateCurrentStep() {
    switch (currentStep) {
        case 1:
            const clientName = document.getElementById('clientName').value.trim();
            if (!clientName) {
                alert('Please enter the client name');
                return false;
            }
            return true;
        case 2:
            if (onboardingData.stakeholders.length === 0) {
                alert('Please add at least one stakeholder');
                return false;
            }
            return true;
        default:
            return true;
    }
}

function saveCurrentStepData() {
    switch (currentStep) {
        case 1:
            onboardingData.client = {
                name: document.getElementById('clientName').value.trim(),
                domain: document.getElementById('clientDomain').value.trim()
            };
            break;
        case 6:
            onboardingData.analyses = Array.from(document.querySelectorAll('input[name="analysis"]:checked'))
                .map(cb => cb.value);
            break;
    }
}

// Stakeholders Management
function initializeStakeholderForm() {
    document.getElementById('addStakeholder').addEventListener('click', addStakeholderField);
}

function addStakeholderField() {
    const stakeholdersList = document.getElementById('stakeholdersList');
    const stakeholderIndex = stakeholdersList.children.length;
    
    const stakeholderDiv = document.createElement('div');
    stakeholderDiv.className = 'stakeholder-item bg-gray-50 p-4 rounded-lg';
    stakeholderDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" name="stakeholder_name_${stakeholderIndex}" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Role/Title *</label>
                <input type="text" name="stakeholder_role_${stakeholderIndex}" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" name="stakeholder_email_${stakeholderIndex}" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" name="stakeholder_phone_${stakeholderIndex}"
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
                <input type="url" name="stakeholder_linkedin_${stakeholderIndex}"
                       placeholder="https://linkedin.com/in/username"
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
        </div>
        <div class="mt-3 flex justify-between items-center">
            <label class="flex items-center">
                <input type="checkbox" name="stakeholder_primary_${stakeholderIndex}" class="mr-2">
                <span class="text-sm">Primary Contact</span>
            </label>
            <button type="button" onclick="removeStakeholder(this)" class="text-red-600 hover:text-red-800 text-sm">
                <i class="fas fa-trash mr-1"></i>Remove
            </button>
        </div>
    `;
    
    stakeholdersList.appendChild(stakeholderDiv);
}

function removeStakeholder(button) {
    button.closest('.stakeholder-item').remove();
}

function saveStakeholders() {
    const stakeholderItems = document.querySelectorAll('.stakeholder-item');
    onboardingData.stakeholders = [];
    
    stakeholderItems.forEach((item, index) => {
        const name = item.querySelector(`input[name="stakeholder_name_${index}"]`)?.value;
        const role = item.querySelector(`input[name="stakeholder_role_${index}"]`)?.value;
        const email = item.querySelector(`input[name="stakeholder_email_${index}"]`)?.value;
        const phone = item.querySelector(`input[name="stakeholder_phone_${index}"]`)?.value;
        const linkedin = item.querySelector(`input[name="stakeholder_linkedin_${index}"]`)?.value;
        const isPrimary = item.querySelector(`input[name="stakeholder_primary_${index}"]`)?.checked;
        
        if (name && role && email) {
            onboardingData.stakeholders.push({
                name,
                role,
                email,
                phone,
                linkedin_url: linkedin,
                is_primary: isPrimary
            });
        }
    });
}

// Social Links Management
function initializeSocialLinksForm() {
    document.getElementById('addSocialLink').addEventListener('click', addSocialLinkField);
}

function addSocialLinkField() {
    const socialLinksList = document.getElementById('socialLinksList');
    const linkIndex = socialLinksList.children.length;
    
    const linkDiv = document.createElement('div');
    linkDiv.className = 'social-link-item bg-gray-50 p-4 rounded-lg';
    linkDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Platform *</label>
                <select name="social_platform_${linkIndex}" required
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Platform</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Twitter">Twitter/X</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Instagram">Instagram</option>
                    <option value="YouTube">YouTube</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Pinterest">Pinterest</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Profile URL *</label>
                <input type="url" name="social_url_${linkIndex}" required
                       placeholder="https://..."
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Handle/Username</label>
                <input type="text" name="social_handle_${linkIndex}"
                       placeholder="@username"
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
        </div>
        <div class="mt-3 flex justify-end">
            <button type="button" onclick="removeSocialLink(this)" class="text-red-600 hover:text-red-800 text-sm">
                <i class="fas fa-trash mr-1"></i>Remove
            </button>
        </div>
    `;
    
    socialLinksList.appendChild(linkDiv);
}

function removeSocialLink(button) {
    button.closest('.social-link-item').remove();
}

function saveSocialLinks() {
    const linkItems = document.querySelectorAll('.social-link-item');
    onboardingData.socialLinks = [];
    
    linkItems.forEach((item, index) => {
        const platform = item.querySelector(`select[name="social_platform_${index}"]`)?.value;
        const url = item.querySelector(`input[name="social_url_${index}"]`)?.value;
        const handle = item.querySelector(`input[name="social_handle_${index}"]`)?.value;
        
        if (platform && url) {
            onboardingData.socialLinks.push({
                platform,
                url,
                handle
            });
        }
    });
}

// File Upload
function initializeFileUpload() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    
    uploadZone.addEventListener('click', () => fileInput.click());
    
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

function handleFiles(files) {
    const uploadedFilesDiv = document.getElementById('uploadedFiles');
    
    Array.from(files).forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between bg-gray-50 p-3 rounded-lg';
        
        const fileType = getFileType(file.name);
        const icon = getFileIcon(fileType);
        
        fileItem.innerHTML = `
            <div class="flex items-center">
                <i class="${icon} text-2xl mr-3"></i>
                <div>
                    <p class="font-medium">${file.name}</p>
                    <p class="text-sm text-gray-600">${formatFileSize(file.size)} - ${fileType}</p>
                </div>
            </div>
            <button type="button" onclick="removeFile(this)" class="text-red-600 hover:text-red-800">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        uploadedFilesDiv.appendChild(fileItem);
        
        // Add to onboarding data
        onboardingData.documents.push({
            name: file.name,
            type: fileType,
            size: file.size,
            file: file
        });
    });
}

function removeFile(button) {
    const fileName = button.closest('div').querySelector('.font-medium').textContent;
    onboardingData.documents = onboardingData.documents.filter(doc => doc.name !== fileName);
    button.closest('div').remove();
}

function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf', 'doc', 'docx'].includes(ext)) return 'document';
    if (['xls', 'xlsx'].includes(ext)) return 'spreadsheet';
    if (['ppt', 'pptx'].includes(ext)) return 'presentation';
    if (['png', 'jpg', 'jpeg'].includes(ext)) return 'image';
    return 'other';
}

function getFileIcon(type) {
    const icons = {
        document: 'fas fa-file-pdf text-red-500',
        spreadsheet: 'fas fa-file-excel text-green-500',
        presentation: 'fas fa-file-powerpoint text-orange-500',
        image: 'fas fa-file-image text-blue-500',
        other: 'fas fa-file text-gray-500'
    };
    return icons[type] || icons.other;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Integration Modal
function openIntegrationModal(integration) {
    const modal = document.getElementById('integrationModal');
    const integrationName = document.getElementById('integrationName');
    const form = document.getElementById('integrationForm');
    
    integrationName.textContent = getIntegrationName(integration);
    form.innerHTML = getIntegrationFormFields(integration);
    form.dataset.integration = integration;
    
    modal.classList.remove('hidden');
}

function closeIntegrationModal() {
    document.getElementById('integrationModal').classList.add('hidden');
}

function getIntegrationName(integration) {
    const names = {
        salesforce: 'Salesforce',
        hubspot: 'HubSpot',
        google: 'Google Workspace',
        notion: 'Notion',
        asana: 'Asana',
        slack: 'Slack',
        whatsapp: 'WhatsApp Business',
        mailchimp: 'Mailchimp',
        hootsuite: 'Hootsuite'
    };
    return names[integration] || integration;
}

function getIntegrationFormFields(integration) {
    const fields = {
        salesforce: `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Instance URL</label>
                <input type="url" name="instance_url" placeholder="https://yourcompany.salesforce.com" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                <input type="password" name="access_token" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
            </div>
        `,
        google: `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Service Account Email</label>
                <input type="email" name="service_account_email" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Private Key</label>
                <textarea name="private_key" rows="3" required
                          class="w-full px-3 py-2 border border-gray-300 rounded-md"></textarea>
            </div>
        `,
        notion: `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Integration Token</label>
                <input type="password" name="token" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Database ID (optional)</label>
                <input type="text" name="database_id"
                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
            </div>
        `,
        slack: `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Bot Token</label>
                <input type="password" name="bot_token" placeholder="xoxb-..." required
                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
                <input type="text" name="channel_id" placeholder="C1234567890"
                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
            </div>
        `,
        default: `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input type="password" name="api_key" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
            </div>
        `
    };
    
    return fields[integration] || fields.default;
}

function saveIntegration() {
    const form = document.getElementById('integrationForm');
    const integration = form.dataset.integration;
    const formData = new FormData(form);
    const config = {};
    
    for (let [key, value] of formData.entries()) {
        config[key] = value;
    }
    
    // Add to onboarding data
    const existingIndex = onboardingData.integrations.findIndex(i => i.type === integration);
    if (existingIndex >= 0) {
        onboardingData.integrations[existingIndex] = {
            type: integration,
            name: getIntegrationName(integration),
            config: config,
            status: 'pending'
        };
    } else {
        onboardingData.integrations.push({
            type: integration,
            name: getIntegrationName(integration),
            config: config,
            status: 'pending'
        });
    }
    
    // Update UI
    const card = document.querySelector(`[data-integration="${integration}"]`);
    const statusSpan = card.querySelector('.integration-status');
    statusSpan.textContent = 'Configured';
    statusSpan.classList.remove('text-gray-500');
    statusSpan.classList.add('text-green-600');
    
    closeIntegrationModal();
}

// Review Summary
function populateReviewSummary() {
    // Save all current data
    saveStakeholders();
    saveSocialLinks();
    
    const summary = document.getElementById('reviewSummary');
    
    summary.innerHTML = `
        <div class="space-y-6">
            <!-- Client Info -->
            <div>
                <h3 class="font-semibold text-lg mb-2"><i class="fas fa-building mr-2"></i>Client Information</h3>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <p><strong>Name:</strong> ${onboardingData.client.name}</p>
                    <p><strong>Domain:</strong> ${onboardingData.client.domain || 'Not provided'}</p>
                </div>
            </div>
            
            <!-- Stakeholders -->
            <div>
                <h3 class="font-semibold text-lg mb-2"><i class="fas fa-users mr-2"></i>Stakeholders (${onboardingData.stakeholders.length})</h3>
                <div class="bg-gray-50 p-4 rounded-lg space-y-2">
                    ${onboardingData.stakeholders.map(s => `
                        <div class="flex justify-between">
                            <span>${s.name} - ${s.role}</span>
                            ${s.is_primary ? '<span class="text-green-600 text-sm">Primary</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Social Links -->
            <div>
                <h3 class="font-semibold text-lg mb-2"><i class="fas fa-share-alt mr-2"></i>Social Links (${onboardingData.socialLinks.length})</h3>
                <div class="bg-gray-50 p-4 rounded-lg">
                    ${onboardingData.socialLinks.length > 0 ? 
                        onboardingData.socialLinks.map(s => `<p>${s.platform}: ${s.handle || s.url}</p>`).join('') :
                        '<p class="text-gray-500">No social links added</p>'
                    }
                </div>
            </div>
            
            <!-- Integrations -->
            <div>
                <h3 class="font-semibold text-lg mb-2"><i class="fas fa-plug mr-2"></i>Integrations (${onboardingData.integrations.length})</h3>
                <div class="bg-gray-50 p-4 rounded-lg">
                    ${onboardingData.integrations.length > 0 ?
                        onboardingData.integrations.map(i => `<p>${i.name} - Configured</p>`).join('') :
                        '<p class="text-gray-500">No integrations configured</p>'
                    }
                </div>
            </div>
            
            <!-- Documents -->
            <div>
                <h3 class="font-semibold text-lg mb-2"><i class="fas fa-file-alt mr-2"></i>Documents (${onboardingData.documents.length})</h3>
                <div class="bg-gray-50 p-4 rounded-lg">
                    ${onboardingData.documents.length > 0 ?
                        onboardingData.documents.map(d => `<p>${d.name} (${formatFileSize(d.size)})</p>`).join('') :
                        '<p class="text-gray-500">No documents uploaded</p>'
                    }
                </div>
            </div>
            
            <!-- Analyses -->
            <div>
                <h3 class="font-semibold text-lg mb-2"><i class="fas fa-chart-bar mr-2"></i>Scheduled Analyses</h3>
                <div class="bg-gray-50 p-4 rounded-lg">
                    ${onboardingData.analyses.map(a => {
                        const names = {
                            market: 'Market Analysis',
                            seo: 'SEO Analysis',
                            competitive: 'Competitive Analysis',
                            audience_icp: 'Audience & ICP Analysis',
                            social_presence: 'Social Presence Analysis'
                        };
                        return `<p>• ${names[a]}</p>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

// Complete Onboarding
async function completeOnboarding() {
    try {
        // Show loading state
        const completeBtn = document.getElementById('completeBtn');
        completeBtn.disabled = true;
        completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
        
        // Send data to server
        const response = await fetch('/api/clients/onboard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(onboardingData)
        });
        
        if (response.ok) {
            const result = await response.json();
            // Redirect to client dashboard
            window.location.href = `/client-dashboard.html?id=${result.clientId}`;
        } else {
            throw new Error('Failed to complete onboarding');
        }
    } catch (error) {
        console.error('Onboarding error:', error);
        alert('An error occurred during onboarding. Please try again.');
        
        // Reset button
        const completeBtn = document.getElementById('completeBtn');
        completeBtn.disabled = false;
        completeBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Complete Onboarding';
    }
}