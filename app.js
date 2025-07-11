// KRTechUpdate PWA - Complete Working Frontend with FormData
// Replace with your actual Google Apps Script URL
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyA1oobLPwMPxIyyp6MKp_RZzEYvAFCmJU19I5oMujvY59m9GFQ-hV7_T7aIF_LEk42/exec';

// Global variables
let currentPage = 'loginPage';
let formData = {};
let uploadedPhotos = []; // Now stores compressed base64 data

// Page management
function showPage(pageId) {
    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        currentPage = pageId;
        
        // Load dropdown data when showing page1
        if (pageId === 'page1' && window.dropdownData) {
            populateDropdowns();
        }
        
        // Generate report when showing page4 (was page5)
        if (pageId === 'page4') {
            generateReport();
        }
    }
}

function deletePurchaseLine(button) {
    button.parentElement.remove();
}

function nextPage() {
    if (!validateCurrentPage()) {
        return;
    }
    
    switch(currentPage) {
        case 'page1':
            showPage('page2');
            break;
        case 'page2':
            showPage('page3');
            break;
        case 'page3':
            showPage('page4'); // Skip old page4, go to new page4 (review)
            break;
        // Remove page4 -> page5 case since page4 is now review
    }
}

function previousPage() {
    switch(currentPage) {
        case 'page2':
            showPage('page1');
            break;
        case 'page3':
            showPage('page2');
            break;
        case 'page4': // Review page goes back to page3
            showPage('page3');
            break;
        // Remove page5 case since there's no page5 anymore
    }
}

// API communication
async function makeAPICall(action, data = {}) {
    try {
        const params = new URLSearchParams({
            action: action,
            data: JSON.stringify(data)
        });
        
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?${params.toString()}`, {
            method: 'GET'
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const responseText = await response.text();
        
        try {
            return JSON.parse(responseText);
        } catch (parseError) {
            console.error('Response is not JSON:', responseText);
            throw new Error('Server returned invalid response: ' + responseText);
        }
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Authentication
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showError('Please enter both username and password');
        return;
    }
    
    try {
        showLoading();
        const response = await makeAPICall('validateLogin', { username, password });
        
        if (response.success) {
            // Store authentication info
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('username', response.username);
            
            // Cache dropdown data from login response
            window.dropdownData = response.dropdownData;
            
            // Initialize form data
            formData = {
                submittedBy: response.username,
                authToken: response.token,
                submissionTime: new Date().toISOString()
            };
            
            hideLoading();
            showPage('page1');
        } else {
            hideLoading();
            showError(response.message);
        }
    } catch (error) {
        hideLoading();
        showError('Login failed. Please try again.');
        console.error('Login error:', error);
    }
}

async function logout() {
    // Clear stored data
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    window.dropdownData = null;
    
    // Reset form data
    formData = {};
    uploadedPhotos = [];
    
    // Reset form fields
    const forms = document.querySelectorAll('form');
    forms.forEach(form => form.reset());
    
    // Clear dynamic content
    clearTechnicians();
    clearMaterials();
    clearPurchases();
    clearPhotos();
    
    // Return to login
    showPage('loginPage');
}

// Check if user is already logged in
async function checkExistingSession() {
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');
    
    if (token && username) {
        try {
            const response = await makeAPICall('validateToken', { token });
            if (response.success) {
                showPage('loginPage');
                const usernameField = document.getElementById('username');
                if (usernameField) {
                    usernameField.value = username;
                }
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('username');
                showPage('loginPage');
            }
        } catch (error) {
            console.error('Session validation error:', error);
            showPage('loginPage');
        }
    } else {
        showPage('loginPage');
    }
    
    hideLoading();
}

// Dropdown Management
function populateDropdowns() {
    if (!window.dropdownData) return;
    
    populateTechniciansDropdown();
    populateJobNumbersDropdown();
    populateVendorsDropdown();
}

function populateTechniciansDropdown() {
    const dropdown = document.getElementById('techniciansList');
    if (dropdown && window.dropdownData.technicians) {
        dropdown.innerHTML = '';
        window.dropdownData.technicians.forEach(tech => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = tech;
            div.onclick = () => selectDropdownItem('technicians', tech);
            dropdown.appendChild(div);
        });
    }
}

function populateJobNumbersDropdown() {
    const dropdown = document.getElementById('jobNumberList');
    if (dropdown && window.dropdownData.jobNumbers) {
        dropdown.innerHTML = '';
        window.dropdownData.jobNumbers.forEach(jobNum => {
            const option = document.createElement('option');
            option.value = jobNum;
            dropdown.appendChild(option);
        });
    }
}

function populateVendorsDropdown() {
    const vendorSelects = document.querySelectorAll('select[id^="vendor"]');
    if (vendorSelects.length > 0 && window.dropdownData.vendors) {
        vendorSelects.forEach(select => {
            select.innerHTML = '<option value="">Select vendor...</option>';
            window.dropdownData.vendors.forEach(vendor => {
                const option = document.createElement('option');
                option.value = vendor;
                option.textContent = vendor;
                select.appendChild(option);
            });
        });
    }
}

// Dropdown functionality
function toggleDropdown(inputId) {
    const list = document.getElementById(inputId + 'List');
    if (list) {
        const isVisible = list.style.display === 'block';
        
        // Hide all other dropdowns
        const allDropdowns = document.querySelectorAll('.dropdown-list');
        allDropdowns.forEach(dropdown => dropdown.style.display = 'none');
        
        // Toggle current dropdown
        list.style.display = isVisible ? 'none' : 'block';
    }
}

function selectDropdownItem(inputId, value) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(inputId + 'List');
    
    if (input) {
        input.value = value;
    }
    
    if (list) {
        list.style.display = 'none';
    }
    
    if (inputId === 'technicians') {
        addTechnician();
    }
}

// Hide dropdowns when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.dropdown-container')) {
        const dropdowns = document.querySelectorAll('.dropdown-list');
        dropdowns.forEach(dropdown => dropdown.style.display = 'none');
    }
});

// Date handling
function setToday() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('dateOfWork');
    if (dateInput) {
        dateInput.value = today;
    }
}

function openDatePicker() {
    const dateInput = document.getElementById('dateOfWork');
    if (dateInput) {
        dateInput.focus();
        dateInput.showPicker();
    }
}

// Technician management
function addTechnician() {
    const input = document.getElementById('technicians');
    const tagsContainer = document.getElementById('technicianTags');
    const value = input.value.trim();
    
    if (value && !isDuplicateTechnician(value)) {
        const tag = document.createElement('div');
        tag.className = 'technician-tag';
        tag.innerHTML = `
            ${value}
            <span class="remove" onclick="removeTechnician(this)">×</span>
        `;
        tagsContainer.appendChild(tag);
        input.value = '';
    }
}

function isDuplicateTechnician(name) {
    const existingTags = document.querySelectorAll('.technician-tag');
    for (let tag of existingTags) {
        if (tag.textContent.replace('×', '').trim() === name) {
            return true;
        }
    }
    return false;
}

function removeTechnician(element) {
    element.parentElement.remove();
}

function clearTechnicians() {
    const tagsContainer = document.getElementById('technicianTags');
    const input = document.getElementById('technicians');
    if (tagsContainer) tagsContainer.innerHTML = '';
    if (input) input.value = '';
}

// Status change handling
function handleStatusChange() {
    const status = document.querySelector('input[name="jobStatus"]:checked')?.value;
    const blockedReasonDiv = document.getElementById('blockedReasonDiv');
    
    if (status === 'blocked') {
        if (blockedReasonDiv) {
            blockedReasonDiv.style.display = 'block';
            const blockedReason = document.getElementById('blockedReason');
            if (blockedReason) {
                blockedReason.required = true;
            }
        }
    } else {
        if (blockedReasonDiv) {
            blockedReasonDiv.style.display = 'none';
            const blockedReason = document.getElementById('blockedReason');
            if (blockedReason) {
                blockedReason.required = false;
            }
        }
    }
}

// Radio button change handlers
function handleMaterialsChange() {
    const materialsYes = document.getElementById('materialsYes').checked;
    
    if (materialsYes) {
        showMaterialsPopup();  // Open popup immediately
    } else {
        // Hide summary if "No" selected
        const summary = document.getElementById('materialsSummary');
        const editBtn = document.getElementById('materialsEditBtn');
        if (summary) summary.style.display = 'none';
        if (editBtn) editBtn.style.display = 'none';
    }
}

function handlePurchasesChange() {
    const purchasesYes = document.getElementById('purchasesYes').checked;
    
    if (purchasesYes) {
        showPurchasesPopup();  // Open popup immediately
    } else {
        // Hide summary if "No" selected
        const summary = document.getElementById('purchasesSummary');
        const editBtn = document.getElementById('purchasesEditBtn');
        if (summary) summary.style.display = 'none';
        if (editBtn) editBtn.style.display = 'none';
    }
}

// NEW: Handle photos change - now opens popup like materials/purchases
function handlePhotosChange() {
    const photosYes = document.getElementById('photosYes').checked;
    
    if (photosYes) {
        showPhotosPopup();  // Open popup immediately
    } else {
        // Clear photos if "No" selected
        clearPhotos();
    }
}

// Materials management
function showMaterialsPopup() {
    const popup = document.getElementById('materialsPopup');
    if (popup) {
        popup.style.display = 'flex';
        const container = document.getElementById('materialsContainer');
        if (container) container.innerHTML = '';  // Clear first
        
        // Load existing materials or add blank line
        if (formData.materials && formData.materials.length > 0) {
            formData.materials.forEach(material => {
                addMaterialLineWithData(material.quantity, material.description);
            });
        } else {
            addMaterialLine();
        }
    }
}

function addMaterialLine() {
    const container = document.getElementById('materialsContainer');
    if (!container) return;
    
    const lineCount = container.children.length + 1;
    
    const row = document.createElement('div');
    row.className = 'materials-row';  // Changed from 'table-row'
    row.innerHTML = `
        <input type="number" id="materialQty${lineCount}" placeholder="Qty" min="1">
        <input type="text" id="materialDesc${lineCount}" placeholder="Description">
        <button type="button" class="delete-btn" onclick="deleteMaterialLine(this)">×</button>
    `;
    container.appendChild(row);
}

function addMaterialLineWithData(qty = '', desc = '') {
    const container = document.getElementById('materialsContainer');
    if (!container) return;
    
    const lineCount = container.children.length + 1;
    
    const row = document.createElement('div');
    row.className = 'materials-row';  // Changed from 'table-row'
    row.innerHTML = `
        <input type="number" id="materialQty${lineCount}" placeholder="Qty" min="1" value="${qty}">
        <input type="text" id="materialDesc${lineCount}" placeholder="Description" value="${desc}">
        <button type="button" class="delete-btn" onclick="deleteMaterialLine(this)">×</button>
    `;
    container.appendChild(row);
}

function deleteMaterialLine(button) {
    button.parentElement.remove();
}

function saveMaterials() {
    const container = document.getElementById('materialsContainer');
    if (!container) return;
    
    const rows = container.querySelectorAll('.materials-row');
    const materials = [];
    
    rows.forEach((row) => {
        const qty = row.querySelector('input[type="number"]').value;
        const desc = row.querySelector('input[type="text"]').value;
        
        if (qty && desc) {
            materials.push({ quantity: qty, description: desc });
        }
    });
    
    formData.materials = materials;
    updateMaterialsSummary();
    hideMaterialsPopup();
}

function updateMaterialsSummary() {
    const summary = document.getElementById('materialsSummary');
    const editBtn = document.getElementById('materialsEditBtn');
    
    if (editBtn) {
        if (formData.materials && formData.materials.length > 0) {
            editBtn.style.display = 'inline-block'; // Only show edit button
        } else {
            editBtn.style.display = 'none';
        }
    }
    
    // Hide the summary completely
    if (summary) {
        summary.style.display = 'none';
    }
}

function clearMaterials() {
    const container = document.getElementById('materialsContainer');
    if (container) container.innerHTML = '';
    formData.materials = [];
    updateMaterialsSummary();
}

// Purchases management
function showPurchasesPopup() {
    const popup = document.getElementById('purchasesPopup');
    if (popup) {
        popup.style.display = 'flex';
        const container = document.getElementById('purchasesContainer');
        if (container) container.innerHTML = '';  // Clear first
        
        // Load existing purchases or add blank line
        if (formData.purchases && formData.purchases.length > 0) {
            formData.purchases.forEach(purchase => {
                addPurchaseLineWithData(purchase.vendor, purchase.description, purchase.amount);
            });
        } else {
            addPurchaseLine();
        }
        
        // Populate ALL vendor dropdowns and set values
        populateVendorsDropdown();
        
        // Set the vendor values after population
        if (formData.purchases && formData.purchases.length > 0) {
            formData.purchases.forEach((purchase, index) => {
                const vendorSelect = document.getElementById(`vendor${index + 1}`);
                if (vendorSelect && purchase.vendor) {
                    vendorSelect.value = purchase.vendor;
                }
            });
        }
    }
}

function addPurchaseLineWithData(vendor = '', desc = '', amount = '') {
    const container = document.getElementById('purchasesContainer');
    if (!container) return;
    
    const lineCount = container.children.length + 1;
    
    const row = document.createElement('div');
    row.className = 'table-row purchase-row';
    row.innerHTML = `
        <select id="vendor${lineCount}">
            <option value="">Select vendor...</option>
        </select>
        <input type="text" id="purchaseDesc${lineCount}" placeholder="Description" value="${desc}">
        <input type="number" id="purchaseAmount${lineCount}" placeholder="Amount" step="0.01" min="0" value="${amount}">
        <button type="button" class="delete-btn" onclick="deletePurchaseLine(this)">×</button>
    `;
    container.appendChild(row);
}

function hideMaterialsPopup() {
    const popup = document.getElementById('materialsPopup');
    if (popup) {
        popup.style.display = 'none';
    }
}

function hidePurchasesPopup() {
    const popup = document.getElementById('purchasesPopup');
    if (popup) {
        popup.style.display = 'none';
    }
}

function addPurchaseLine() {
    const container = document.getElementById('purchasesContainer');
    if (!container) return;
    
    const lineCount = container.children.length + 1;
    
    const row = document.createElement('div');
    row.className = 'table-row purchase-row';
    row.innerHTML = `
        <select id="vendor${lineCount}">
            <option value="">Select vendor...</option>
        </select>
        <input type="text" id="purchaseDesc${lineCount}" placeholder="Description">
        <input type="number" id="purchaseAmount${lineCount}" placeholder="Amount" step="0.01" min="0">
        <button type="button" class="delete-btn" onclick="deletePurchaseLine(this)">×</button>
    `;
    container.appendChild(row);
    
    // Only populate the new dropdown, not all dropdowns
    const newSelect = document.getElementById(`vendor${lineCount}`);
    if (newSelect && window.dropdownData && window.dropdownData.vendors) {
        window.dropdownData.vendors.forEach(vendor => {
            const option = document.createElement('option');
            option.value = vendor;
            option.textContent = vendor;
            newSelect.appendChild(option);
        });
    }
}

function savePurchases() {
    const container = document.getElementById('purchasesContainer');
    if (!container) return;
    
    const rows = container.querySelectorAll('.table-row');
    const purchases = [];
    
    rows.forEach((row) => {
        const vendor = row.querySelector('select').value;
        const desc = row.querySelector('input[type="text"]').value;
        const amount = row.querySelector('input[type="number"]').value;
        
        if (vendor && desc && amount) {
            purchases.push({ vendor, description: desc, amount });
        }
    });
    
    formData.purchases = purchases;
    updatePurchasesSummary();
    hidePurchasesPopup();
}

function updatePurchasesSummary() {
    const summary = document.getElementById('purchasesSummary');
    const editBtn = document.getElementById('purchasesEditBtn');
    
    if (editBtn) {
        if (formData.purchases && formData.purchases.length > 0) {
            editBtn.style.display = 'inline-block'; // Only show edit button
        } else {
            editBtn.style.display = 'none';
        }
    }
    
    // Hide the summary completely
    if (summary) {
        summary.style.display = 'none';
    }
}

function clearPurchases() {
    const container = document.getElementById('purchasesContainer');
    if (container) container.innerHTML = '';
    formData.purchases = [];
    updatePurchasesSummary();
}

// NEW: Photos popup management
function showPhotosPopup() {
    const popup = document.getElementById('photosPopup');
    if (popup) {
        popup.style.display = 'flex';
    }
}

function hidePhotosPopup() {
    const popup = document.getElementById('photosPopup');
    if (popup) {
        popup.style.display = 'none';
        updatePhotosEditButton(); // Add this line
    }
}

function updatePhotosEditButton() {
    const editBtn = document.getElementById('photosEditBtn');
    
    if (editBtn) {
        if (uploadedPhotos && uploadedPhotos.length > 0) {
            editBtn.style.display = 'inline-block'; // Only show edit button
        } else {
            editBtn.style.display = 'none';
        }
    }
}

function removePhoto(button, fileName) {
    uploadedPhotos = uploadedPhotos.filter(photo => photo.name !== fileName);
    button.parentElement.remove();
    updatePhotosEditButton(); // Add this line
}

// UPDATED: Photo management with compression and Blob storage
async function handlePhotoUpload(event) {
    const files = Array.from(event.target.files);
    
    for (const file of files) {
        if (file.type.startsWith('image/')) {
            try {
                // Compress more aggressively - target 150-200KB
                const compressedData = await compressImageToBase64(file, 150); // 150KB target
                
                const photoData = {
                    data: compressedData.split(',')[1], // Remove data:image/jpeg;base64, prefix
                    type: file.type,
                    name: file.name,
                    size: Math.round(compressedData.length * 0.75) // Approximate actual size
                };
                
                uploadedPhotos.push(photoData);
                displayPhotoThumbnail(file.name, compressedData);
                
            } catch (error) {
                console.error('Error processing photo:', error);
                showError('Failed to process photo: ' + file.name);
            }
        }
    }
    
    event.target.value = '';
}

// UPDATED: More aggressive image compression targeting specific file sizes
async function compressImageToBase64(file, maxSizeKB = 150) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // More aggressive initial sizing
            let { width, height } = img;
            
            // Start with smaller max dimensions
            let maxWidth = 1280;  // Reduced from 1920
            let maxHeight = 720;  // Reduced from 1080
            
            // If image is very large, be even more aggressive
            if (width > 2000 || height > 2000) {
                maxWidth = 800;
                maxHeight = 600;
            }
            
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw image
            ctx.drawImage(img, 0, 0, width, height);
            
            // Try different quality levels with more aggressive steps
            let quality = 0.7; // Start lower
            
            const tryCompress = () => {
                const dataUrl = canvas.toDataURL(file.type || 'image/jpeg', quality);
                const sizeKB = Math.round(dataUrl.length * 0.75 / 1024); // Approximate size in KB
                
                console.log(`Compression attempt: ${Math.round(quality * 100)}% quality = ${sizeKB}KB`);
                
                if (sizeKB <= maxSizeKB || quality <= 0.1) {
                    console.log(`Final result: ${sizeKB}KB at ${Math.round(quality * 100)}% quality`);
                    resolve(dataUrl);
                } else {
                    quality -= 0.15; // Bigger steps down
                    if (quality < 0.1) quality = 0.1;
                    tryCompress();
                }
            };
            
            tryCompress();
        };
        
        img.src = URL.createObjectURL(file);
    });
}

function displayPhotoThumbnail(name, dataUrl) {
    const gallery = document.getElementById('photoGallery');
    if (!gallery) return;
    
    // Calculate approximate size for display
    const sizeKB = Math.round(dataUrl.length * 0.75 / 1024);
    
    const thumbnail = document.createElement('div');
    thumbnail.className = 'photo-thumbnail';
    thumbnail.innerHTML = `
        <img src="${dataUrl}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover;">
        <button class="photo-delete" onclick="removePhoto(this, '${name}')">×</button>
        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); color: white; padding: 2px; font-size: 10px; text-align: center;">
            ${name}<br>${sizeKB}KB
        </div>
    `;
    gallery.appendChild(thumbnail);
}

function clearPhotos() {
    uploadedPhotos = [];
    const gallery = document.getElementById('photoGallery');
    const photoInput = document.getElementById('photoInput');
    if (gallery) gallery.innerHTML = '';
    if (photoInput) photoInput.value = '';
}

// Form validation - UPDATED to only have 3 pages plus review
function validateCurrentPage() {
    switch(currentPage) {
        case 'page1':
            return validatePage1();
        case 'page2':
            return validatePage2();
        case 'page3':
            return validatePage3(); // Now includes photos
        // Remove validatePage4 since photos are now on page3
        default:
            return true;
    }
}

function validatePage1() {
    const technicians = document.querySelectorAll('.technician-tag');
    const dateOfWork = document.getElementById('dateOfWork').value;
    const facilityCode = document.getElementById('facilityCode').value;
    
    if (technicians.length === 0) {
        showError('Please add at least one technician');
        return false;
    }
    
    if (!dateOfWork) {
        showError('Please select the date of work');
        return false;
    }
    
    if (!facilityCode.trim()) {
        showError('Please enter the facility code');
        return false;
    }
    
    formData.technicians = Array.from(technicians).map(tag => 
        tag.textContent.replace('×', '').trim()
    );
    formData.dateOfWork = dateOfWork;
    formData.facilityCode = facilityCode.trim();
    formData.jobNumber = document.getElementById('jobNumber').value.trim();
    
    return true;
}

function validatePage2() {
    const jobStatus = document.querySelector('input[name="jobStatus"]:checked');
    const workDescription = document.getElementById('workDescription').value.trim();
    
    if (!jobStatus) {
        showError('Please select a job status');
        return false;
    }
    
    if (!workDescription) {
        showError('Please enter a work description');
        return false;
    }
    
    if (jobStatus.value === 'blocked') {
        const blockedReason = document.getElementById('blockedReason');
        if (blockedReason && !blockedReason.value.trim()) {
            showError('Please enter the reason the job is blocked');
            return false;
        }
        formData.blockedReason = blockedReason ? blockedReason.value.trim() : '';
    }
    
    formData.jobStatus = jobStatus.value;
    formData.workDescription = workDescription;
    formData.outstandingIssues = document.getElementById('outstandingIssues').value.trim();
    
    return true;
}

// UPDATED: validatePage3 now includes photos validation
function validatePage3() {
    const materialsUsed = document.querySelector('input[name="materialsUsed"]:checked');
    const liftUsed = document.querySelector('input[name="liftUsed"]:checked');
    const purchasesUsed = document.querySelector('input[name="purchasesUsed"]:checked');
    const photosUpload = document.querySelector('input[name="uploadPhotos"]:checked');
    
    if (!materialsUsed) {
        showError('Please specify if materials were used');
        return false;
    }
    
    if (!liftUsed) {
        showError('Please specify if a lift was used');
        return false;
    }
    
    if (!purchasesUsed) {
        showError('Please specify if purchases were made');
        return false;
    }
    
    if (!photosUpload) {
        showError('Please specify if you want to upload photos');
        return false;
    }
    
    formData.materialsUsed = materialsUsed.value;
    formData.liftUsed = liftUsed.value;
    formData.purchasesUsed = purchasesUsed.value;
    // Note: photos are handled separately as Blobs in uploadedPhotos array
    
    return true;
}

// Report generation and submission
function generateReport() {
    const reportContainer = document.getElementById('reportContent');
    if (!reportContainer) return;
    
    const html = `
        <div class="report-section">
            <h3>Site Information</h3>
            <div class="report-grid">
                <div class="report-item">
                    <div class="report-label">Technician(s)</div>
                    <div class="report-value">${formData.technicians.join(', ')}</div>
                </div>
                <div class="report-item">
                    <div class="report-label">Date of Work</div>
                    <div class="report-value">${new Date(formData.dateOfWork).toLocaleDateString()}</div>
                </div>
                <div class="report-item">
                    <div class="report-label">Facility Code</div>
                    <div class="report-value">${formData.facilityCode}</div>
                </div>
                <div class="report-item">
                    <div class="report-label">Job Number</div>
                    <div class="report-value">${formData.jobNumber || 'None entered'}</div>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h3>Job Details</h3>
            <div class="report-grid">
                <div class="report-item">
                    <div class="report-label">Status</div>
                    <div class="report-value">${formatJobStatus(formData.jobStatus)}</div>
                </div>
                ${formData.jobStatus === 'blocked' ? `
                <div class="report-item" style="grid-column: 1 / -1;">
                    <div class="blocked-reason">
                        <strong>Blocked Reason:</strong><br>
                        ${formData.blockedReason}
                    </div>
                </div>
                ` : ''}
            </div>
            <div class="report-item">
                <div class="report-label">Work Description</div>
                <div class="report-value">${formData.workDescription}</div>
            </div>
            <div class="report-item">
                <div class="report-label">Outstanding Issues</div>
                <div class="report-value">${formData.outstandingIssues || 'None'}</div>
            </div>
        </div>
        
        <div class="report-section">
            <h3>Materials & Expenses</h3>
            <div class="report-item">
                <div class="report-label">Materials Used</div>
                <div class="report-value">
                    ${formData.materialsUsed === 'yes' ? 
                        (formData.materials && formData.materials.length > 0 ? 
                            formData.materials.map(m => `• ${m.quantity} - ${m.description}`).join('<br>') : 
                            'Yes (no details provided)'
                        ) : 'No'
                    }
                </div>
            </div>
            <div class="report-item">
                <div class="report-label">Lift Used</div>
                <div class="report-value">${formData.liftUsed === 'yes' ? 'Yes' : 'No'}</div>
            </div>
            <div class="report-item">
                <div class="report-label">Purchases</div>
                <div class="report-value">
                    ${formData.purchasesUsed === 'yes' ? 
                        (formData.purchases && formData.purchases.length > 0 ? 
                            formData.purchases.map(p => `• ${p.vendor} - ${p.description} - ${p.amount}`).join('<br>') : 
                            'Yes (no details provided)'
                        ) : 'No'
                    }
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h3>Photos</h3>
            <div class="report-value">
                ${uploadedPhotos && uploadedPhotos.length > 0 ? 
                    `${uploadedPhotos.length} photo(s) uploaded` : 
                    'None uploaded'
                }
            </div>
        </div>
        
        <div class="report-section">
            <h3>Customer Information</h3>
            <div class="report-item">
                <div class="report-label">Customer Email</div>
                <div class="report-value">${formData.customerEmail || 'None provided'}</div>
            </div>
        </div>
    `;
    
    reportContainer.innerHTML = html;
}

// UPDATED: Submit form using FormData instead of base64
async function submitForm() {
   try {
       showLoading();

       formData.customerEmail = document.getElementById('customerEmail').value.trim();
       formData.photos = uploadedPhotos;
       
       // Use POST with body instead of GET with URL params for photos
       let result;
       if (uploadedPhotos.length > 0) {
           // Send as POST request body for photos - NO Content-Type header
           const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
               method: 'POST',
               body: JSON.stringify({
                   action: 'submitForm',
                   formData: formData
               })
           });
           
           const responseText = await response.text();
           result = JSON.parse(responseText);
       } else {
           // Use regular GET for no photos
           result = await makeAPICall('submitForm', { formData });
       }
       
       if (result.success) {
           hideLoading();
           showSuccess('Report submitted successfully!', result.message);
           
           setTimeout(() => {
               // Reset form data
               formData = {
                   submittedBy: formData.submittedBy,
                   authToken: formData.authToken,
                   submissionTime: new Date().toISOString()
               };
               uploadedPhotos = [];
               
               // Clear technicians
               clearTechnicians();
               
               // Clear all input fields manually
               document.getElementById('dateOfWork').value = '';
               document.getElementById('facilityCode').value = '';
               document.getElementById('jobNumber').value = '';
               document.getElementById('workDescription').value = '';
               document.getElementById('outstandingIssues').value = '';
               document.getElementById('customerEmail').value = '';
               
               // Clear radio buttons
               const radioButtons = document.querySelectorAll('input[type="radio"]');
               radioButtons.forEach(radio => radio.checked = false);
               
               // Clear materials and purchases
               clearMaterials();
               clearPurchases();
               clearPhotos();
               
               // Reset date to today
               setToday();
               
               showPage('page1');
           }, 4000);
       } else {
           hideLoading();
           showError('Submission failed: ' + result.message);
       }
   } catch (error) {
       hideLoading();
       showError('Submission failed. Please try again.');
       console.error('Submission error:', error);
   }
}

// Utility functions
function formatJobStatus(status) {
    switch(status) {
        case 'complete': return 'Complete';
        case 'returnTrip': return 'Return Trip';
        case 'blocked': return 'Blocked';
        default: return 'Unknown';
    }
}

function showLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
}

function showError(message) {
    const existingError = document.querySelector('.error');
    if (existingError) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    
    const currentPageElement = document.querySelector('.page.active');
    if (currentPageElement) {
        currentPageElement.insertBefore(errorDiv, currentPageElement.firstChild);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

function showSuccess(title, message) {
    const successTitle = document.getElementById('successTitle');
    const successMessage = document.getElementById('successMessage');
    
    if (successTitle) successTitle.textContent = title;
    if (successMessage) successMessage.textContent = message;
    
    showPage('success');
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('KRTechUpdate PWA loaded');
    
    // Set default date to today
    setToday();
    
    // Add event listeners
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Add status change listeners
    const statusRadios = document.querySelectorAll('input[name="jobStatus"]');
    statusRadios.forEach(radio => {
        radio.addEventListener('change', handleStatusChange);
    });
    
    // Add materials/purchases/photos change listeners
    const materialsRadios = document.querySelectorAll('input[name="materialsUsed"]');
    materialsRadios.forEach(radio => {
        radio.addEventListener('change', handleMaterialsChange);
    });
    
    const purchasesRadios = document.querySelectorAll('input[name="purchasesUsed"]');
    purchasesRadios.forEach(radio => {
        radio.addEventListener('change', handlePurchasesChange);
    });
    
    const photosRadios = document.querySelectorAll('input[name="uploadPhotos"]');
    photosRadios.forEach(radio => {
        radio.addEventListener('change', handlePhotosChange);
    });
    
    // Check for existing session
    checkExistingSession();
});