// admin-script.js - IMPROVED VERSION with Full Customizability

// Initialize Firebase (firebase is already loaded globally)
const auth = firebase.auth();
const database = firebase.database();

// Global variables
let currentUser = null;
let allAppointments = [];
let currentSpecialtyFilter = 'all';
const MAX_APPOINTMENTS_PER_DOCTOR_PER_DAY = 4;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    setupAuthListener();
    setupLoginForm();
    setupNavigation();
    setupLogout();
    setupShiftValidation();
});

// ===== AUTHENTICATION =====
function setupAuthListener() {
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            showDashboard();
            loadDashboardData();
        } else {
            currentUser = null;
            showLogin();
        }
    });
}

function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        const errorDiv = document.getElementById('loginError');
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
            errorDiv.classList.add('d-none');
        } catch (error) {
            errorDiv.textContent = 'Invalid email or password. Please try again.';
            errorDiv.classList.remove('d-none');
        }
    });
}

function setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        auth.signOut();
    });
}

function showLogin() {
    document.getElementById('loginScreen').classList.remove('d-none');
    document.getElementById('adminDashboard').classList.add('d-none');
}

function showDashboard() {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('adminDashboard').classList.remove('d-none');
    document.getElementById('adminUserEmail').textContent = currentUser.email;
}

// ===== NAVIGATION =====
function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.add('d-none');
            });
            
            const sectionName = link.getAttribute('data-section');
            document.getElementById(sectionName + 'Section').classList.remove('d-none');
            
            loadSectionData(sectionName);
        });
    });
}

function loadSectionData(sectionName) {
    switch(sectionName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'appointments':
            loadAllAppointments();
            break;
        case 'images':
            loadImages();
            break;
        case 'content':
            loadUnifiedContent();
            break;
        case 'doctors':
            loadDoctors();
            loadSpecialtiesForDropdown();
            loadSpecialtyFilters();
            break;
        case 'archive':
            loadAppointmentArchive();
            break;
    }
}

// ===== DASHBOARD FUNCTIONS =====
async function loadDashboardData() {
    try {
        const appointmentsSnapshot = await database.ref('appointments').once('value');
        const appointments = appointmentsSnapshot.val() || {};
        const appointmentsArray = Object.values(appointments);
        
        document.getElementById('totalAppointments').textContent = appointmentsArray.length;
        document.getElementById('pendingAppointments').textContent = 
            appointmentsArray.filter(a => a.status === 'pending').length;
        
        const doctorsSnapshot = await database.ref('doctors').once('value');
        const doctors = doctorsSnapshot.val() || {};
        const count = Object.keys(doctors).length;
        document.getElementById('totalDoctors').textContent = count;

        const imagesSnapshot = await database.ref('images').once('value');
        const images = imagesSnapshot.val() || {};
        document.getElementById('totalImages').textContent = Object.keys(images).length;
        
        loadRecentAppointments(appointmentsArray);
        checkDoctorAvailability();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'error');
    }
}

function loadRecentAppointments(appointments) {
    const container = document.getElementById('recentAppointmentsList');
    
    if (!appointments || appointments.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No appointments yet.</p>';
        return;
    }
    
    const sortedAppointments = appointments
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5);
    
    let html = '<div class="list-group">';
    sortedAppointments.forEach(apt => {
        const statusBadge = getStatusBadge(apt.status || 'pending');
        html += `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${apt.name}</h6>
                        <small class="text-muted">${apt.doctor} - ${apt.date} at ${apt.time}</small>
                    </div>
                    ${statusBadge}
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

window.updateAppointmentStatus = async function(appointmentId, status) {
    // Store current scroll position
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    
    try {
        await database.ref(`appointments/${appointmentId}`).update({ status });
        showNotification(`Appointment ${status} successfully!`, 'success');
        
        // Get current active filter
        const activeFilter = document.querySelector('.filter-btn.active');
        let currentFilter = 'all';
        if (activeFilter) {
            const activeText = activeFilter.textContent.toLowerCase();
            if (activeText.includes('pending')) currentFilter = 'pending';
            else if (activeText.includes('confirmed')) currentFilter = 'confirmed';
            else if (activeText.includes('cancelled')) currentFilter = 'cancelled';
        }
        
        // Reload appointments with current filter
        await loadAllAppointments(currentFilter);
        
        // Restore scroll position
        setTimeout(() => {
            window.scrollTo({
                top: scrollPosition,
                behavior: 'auto'
            });
        }, 100);
        
        loadDashboardData();
    } catch (error) {
        console.error('Error updating appointment:', error);
        showNotification('Error updating appointment', 'error');
    }
};

async function loadAllAppointments(filterStatus = 'all') {
    const tbody = document.getElementById('appointmentsTableBody');
    
    // Store scroll position before any DOM changes
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner-border spinner-border-sm me-2"></div>Loading...</td></tr>';
    
    try {
        const snapshot = await database.ref('appointments').once('value');
        const appointments = snapshot.val() || {};
        allAppointments = Object.entries(appointments).map(([id, data]) => ({
            id,
            ...data
        }));
        
        if (allAppointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No appointments found.</td></tr>';
            return;
        }
        
        let filteredAppointments = allAppointments;
        if (filterStatus !== 'all') {
            filteredAppointments = allAppointments.filter(apt => apt.status === filterStatus);
        }
        
        filteredAppointments.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (filteredAppointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No appointments with this status.</td></tr>';
            return;
        }
        
        let html = '';
        filteredAppointments.forEach(apt => {
            const statusBadge = getStatusBadge(apt.status || 'pending');
            html += `
                <tr>
                    <td>${apt.date}</td>
                    <td>${apt.time}</td>
                    <td>${apt.name}</td>
                    <td>${apt.doctor}</td>
                    <td>${apt.phone}</td>
                    <td>${statusBadge}</td>
                    <td class="action-buttons">
                        <button class="btn btn-sm btn-success" onclick="updateAppointmentStatus('${apt.id}', 'confirmed')" title="Confirm">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="updateAppointmentStatus('${apt.id}', 'cancelled')" title="Cancel">
                            <i class="fas fa-times"></i>
                        </button>
                        <button class="btn btn-sm btn-info" onclick="viewAppointmentDetails('${apt.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        // Restore scroll position after DOM update
        setTimeout(() => {
            window.scrollTo({
                top: scrollPosition,
                behavior: 'auto'
            });
        }, 50);
        
    } catch (error) {
        console.error('Error loading appointments:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading appointments.</td></tr>';
    }
}

window.filterAppointments = async function(status) {
    // Store current scroll position
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    
    // Prevent default behavior that might cause scrolling
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Update active button state
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    try {
        // Show loading state
        const tbody = document.getElementById('appointmentsTableBody');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner-border spinner-border-sm me-2"></div>Loading appointments...</td></tr>';
        
        // Load appointments with the selected filter
        await loadAllAppointments(status);
        
        // Restore scroll position after content loads
        setTimeout(() => {
            window.scrollTo({
                top: scrollPosition,
                behavior: 'auto'
            });
        }, 100);
        
    } catch (error) {
        console.error('Error filtering appointments:', error);
        showNotification('Error loading appointments', 'error');
    }
};

window.viewAppointmentDetails = async function(appointmentId, source = 'current') {
    // Store current scroll position
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    
    try {
        const ref = source === 'archive' ? 
            database.ref(`appointmentArchive/${appointmentId}`) : 
            database.ref(`appointments/${appointmentId}`);
            
        const snapshot = await ref.once('value');
        const apt = snapshot.val();
        
        if (!apt) {
            showNotification('Appointment not found', 'error');
            return;
        }
        
        const modalContent = `
            <div class="appointment-details">
                <p><strong>Patient:</strong> ${apt.name}</p>
                <p><strong>Doctor:</strong> ${apt.doctor}</p>
                <p><strong>Date:</strong> ${apt.date}</p>
                <p><strong>Time:</strong> ${apt.time}</p>
                <p><strong>Phone:</strong> ${apt.phone}</p>
                <p><strong>Email:</strong> ${apt.email || 'N/A'}</p>
                <p><strong>Reason:</strong> ${apt.reason || 'N/A'}</p>
                <p><strong>Status:</strong> <span class="badge ${apt.status === 'confirmed' ? 'bg-success' : apt.status === 'cancelled' ? 'bg-danger' : 'bg-warning'}">${apt.status || 'pending'}</span></p>
                <p><strong>Submitted:</strong> ${new Date(apt.timestamp).toLocaleString()}</p>
                ${apt.archivedAt ? `<p><strong>Archived:</strong> ${new Date(apt.archivedAt).toLocaleString()}</p>` : ''}
                ${source === 'archive' ? `<p><strong>Source:</strong> <span class="badge bg-secondary">Archived</span></p>` : ''}
            </div>
        `;
        
        const existingModal = document.getElementById('viewDetailsModal');
        if (existingModal) existingModal.remove();
        
        const modalHTML = `
            <div class="modal fade" id="viewDetailsModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Appointment Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${modalContent}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('viewDetailsModal'));
        
        // Add event listener to restore scroll position when modal closes
        modal._element.addEventListener('hidden.bs.modal', function () {
            setTimeout(() => {
                window.scrollTo({
                    top: scrollPosition,
                    behavior: 'auto'
                });
            }, 100);
        });
        
        modal.show();
        
    } catch (error) {
        console.error('Error viewing appointment:', error);
        showNotification('Error loading appointment details', 'error');
    }
};

// ===== ENHANCED DOCTOR APPOINTMENT VIEWING =====
// ===== ENHANCED DOCTOR APPOINTMENT VIEWING =====
window.viewDoctorAppointments = async function(doctorId, doctorName) {
    try {
        const snapshot = await database.ref('appointments').once('value');
        const appointments = snapshot.val() || {};
        const today = new Date().toISOString().split('T')[0];
        
        const doctorAppointments = Object.entries(appointments)
            .filter(([id, apt]) => apt.doctor === doctorId)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const upcomingAppointments = doctorAppointments.filter(apt => apt.date >= today);
        const pastAppointments = doctorAppointments.filter(apt => apt.date < today);
        
        // Count TODAY'S appointments specifically
        const todaysAppointments = doctorAppointments.filter(apt => apt.date === today).length;
        
        const appointmentStats = {
            total: doctorAppointments.length,
            upcoming: upcomingAppointments.length,
            past: pastAppointments.length,
            today: todaysAppointments, // This should be just today's count
            maxDaily: MAX_APPOINTMENTS_PER_DOCTOR_PER_DAY
        };
        
        showDoctorAppointmentsModal(doctorName, appointmentStats, upcomingAppointments, pastAppointments);
        
    } catch (error) {
        console.error('Error loading doctor appointments:', error);
        showNotification('Error loading appointments', 'error');
    }
};

function showDoctorAppointmentsModal(doctorName, stats, upcomingAppointments, pastAppointments) {
    const modalContent = `
        <div class="doctor-appointments-view">
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="stat-card bg-light">
                        <div class="stat-icon bg-primary">
                            <i class="fas fa-calendar-alt"></i>
                        </div>
                        <div class="stat-details">
                            <h3>${stats.total}</h3>
                            <p>Total Appointments</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card bg-light">
                        <div class="stat-icon bg-success">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="stat-details">
                            <h3>${stats.upcoming}</h3>
                            <p>Upcoming</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card bg-light">
                        <div class="stat-icon bg-info">
                            <i class="fas fa-calendar-day"></i>
                        </div>
                        <div class="stat-details">
                            <h3>${stats.today}</h3>
                            <p>Today</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card bg-light">
                        <div class="stat-icon bg-warning">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div class="stat-details">
                            <h3>${stats.maxDaily}</h3>
                            <p>Daily Limit</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-6">
                    <h5>Upcoming Appointments (${upcomingAppointments.length})</h5>
                    ${upcomingAppointments.length > 0 ? 
                        `<div class="appointment-list" style="max-height: 300px; overflow-y: auto;">
                            ${upcomingAppointments.map(apt => `
                                <div class="appointment-item border rounded p-2 mb-2">
                                    <div class="d-flex justify-content-between">
                                        <strong>${formatDisplayDate(apt.date)}</strong>
                                        <span class="badge ${apt.status === 'confirmed' ? 'bg-success' : apt.status === 'pending' ? 'bg-warning' : 'bg-danger'}">
                                            ${apt.status}
                                        </span>
                                    </div>
                                    <div class="text-muted small">
                                        ${apt.time} - ${apt.name} (${apt.phone})
                                    </div>
                                    ${apt.reason ? `<div class="small mt-1"><strong>Reason:</strong> ${apt.reason}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>` : 
                        '<p class="text-muted">No upcoming appointments</p>'
                    }
                </div>
                
                <div class="col-md-6">
                    <h5>Appointment History (${pastAppointments.length})</h5>
                    ${pastAppointments.length > 0 ? 
                        `<div class="appointment-list" style="max-height: 300px; overflow-y: auto;">
                            ${pastAppointments.slice(0, 10).map(apt => `
                                <div class="appointment-item border rounded p-2 mb-2">
                                    <div class="d-flex justify-content-between">
                                        <strong>${formatDisplayDate(apt.date)}</strong>
                                        <span class="badge ${apt.status === 'confirmed' ? 'bg-success' : apt.status === 'cancelled' ? 'bg-danger' : 'bg-secondary'}">
                                            ${apt.status}
                                        </span>
                                    </div>
                                    <div class="text-muted small">
                                        ${apt.time} - ${apt.name}
                                    </div>
                                </div>
                            `).join('')}
                            ${pastAppointments.length > 10 ? 
                                `<div class="text-center mt-2">
                                    <small class="text-muted">+ ${pastAppointments.length - 10} more appointments</small>
                                </div>` : ''
                            }
                        </div>` : 
                        '<p class="text-muted">No past appointments</p>'
                    }
                </div>
            </div>
            
            ${stats.today >= stats.maxDaily ? 
                `<div class="alert alert-warning mt-3">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Warning:</strong> This doctor has reached/exceeded today's appointment limit (${stats.today}/${stats.maxDaily})
                </div>` : 
                stats.today >= stats.maxDaily - 2 && stats.today > 0 ?
                `<div class="alert alert-info mt-3">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Note:</strong> This doctor is approaching today's appointment limit (${stats.today}/${stats.maxDaily})
                </div>` : ''
            }
        </div>
    `;
    
    const existingModal = document.getElementById('doctorAppointmentsModal');
    if (existingModal) existingModal.remove();
    
    const modalHTML = `
        <div class="modal fade" id="doctorAppointmentsModal" tabindex="-1">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Appointments for ${doctorName}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${modalContent}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('doctorAppointmentsModal'));
    modal.show();
}

// ===== APPOINTMENT CLEANUP & ARCHIVE =====
window.smartCleanupAppointments = async function() {
    if (!confirm('This will move old appointments to archive and clean up the main list. Continue?')) {
        return;
    }

    const cleanupButton = event.target;
    const originalText = cleanupButton.innerHTML;
    cleanupButton.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Cleaning...';
    cleanupButton.disabled = true;

    try {
        const snapshot = await database.ref('appointments').once('value');
        const appointments = snapshot.val() || {};
        const today = new Date().toISOString().split('T')[0];
        
        let archivedCount = 0;
        let deletedCount = 0;
        const updatePromises = [];

        Object.entries(appointments).forEach(([appointmentId, appointment]) => {
            if (appointment.date < today) {
                if (appointment.status === 'confirmed' || appointment.status === 'cancelled') {
                    updatePromises.push(
                        database.ref(`appointmentArchive/${appointmentId}`).set({
                            ...appointment,
                            archivedAt: new Date().toISOString()
                        }).then(() => {
                            return database.ref(`appointments/${appointmentId}`).remove();
                        })
                    );
                    archivedCount++;
                    deletedCount++;
                } else if (appointment.status === 'pending') {
                    updatePromises.push(
                        database.ref(`appointments/${appointmentId}`).update({ 
                            status: 'expired',
                            expiredAt: new Date().toISOString()
                        })
                    );
                }
            }
        });
        
        await Promise.all(updatePromises);
        
        let message = '';
        if (archivedCount > 0) {
            message = `Cleanup completed! Archived ${archivedCount} old appointments and cleaned main list.`;
        } else {
            message = 'No old appointments found to clean up.';
        }
        
        showNotification(message, 'success');
        loadAllAppointments();
        loadAppointmentArchive();
        
    } catch (error) {
        console.error('Error during smart cleanup:', error);
        showNotification('Error during cleanup', 'error');
    } finally {
        cleanupButton.innerHTML = originalText;
        cleanupButton.disabled = false;
    }
}

async function loadAppointmentArchive() {
    const container = document.getElementById('appointmentArchive');
    container.innerHTML = '<div class="text-center p-3"><div class="spinner-border"></div><p class="mt-2">Loading archive...</p></div>';

    try {
        const [archiveSnapshot, appointmentsSnapshot] = await Promise.all([
            database.ref('appointmentArchive').once('value').catch(() => ({ val: () => ({}) })),
            database.ref('appointments').once('value')
        ]);
        
        const archive = archiveSnapshot.val() || {};
        const appointments = appointmentsSnapshot.val() || {};
        
        const today = new Date().toISOString().split('T')[0];
        
        const allPastAppointments = [
            ...Object.entries(appointments)
                .filter(([id, apt]) => apt.date < today)
                .map(([id, data]) => ({ id, ...data, source: 'current' })),
            ...Object.entries(archive)
                .map(([id, data]) => ({ id, ...data, source: 'archive' }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allPastAppointments.length === 0) {
            container.innerHTML = `
                <div class="text-center p-4">
                    <i class="fas fa-archive fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No archived appointments found.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6>Found ${allPastAppointments.length} past appointments</h6>
                <div>
                    <button class="btn btn-sm btn-outline-primary me-2" onclick="exportArchiveData()">
                        <i class="fas fa-download me-1"></i> Export
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteAllArchived()">
                        <i class="fas fa-trash me-1"></i> Clean All
                    </button>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-hover appointment-archive-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Patient</th>
                            <th>Doctor</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th>Source</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        allPastAppointments.forEach(apt => {
            const statusBadge = getStatusBadge(apt.status);
            const sourceBadge = apt.source === 'archive' ? 
                '<span class="badge bg-secondary">Archived</span>' : 
                '<span class="badge bg-info">Current</span>';
            
            html += `
                <tr>
                    <td><small>${formatDisplayDate(apt.date)}</small></td>
                    <td><small>${apt.time}</small></td>
                    <td>${apt.name}</td>
                    <td><small>${apt.doctor}</small></td>
                    <td><small>${apt.phone}</small></td>
                    <td>${statusBadge}</td>
                    <td>${sourceBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-info" onclick="viewAppointmentDetails('${apt.id}', '${apt.source}')" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${apt.source === 'current' ? 
                            `<button class="btn btn-sm btn-outline-warning" onclick="moveToArchive('${apt.id}')" title="Archive">
                                <i class="fas fa-archive"></i>
                            </button>` : ''
                        }
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteArchivedAppointment('${apt.id}', '${apt.source}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading archive:', error);
        container.innerHTML = '<div class="alert alert-danger">Error loading archive</div>';
    }
}

window.moveToArchive = async function(appointmentId) {
    try {
        const snapshot = await database.ref(`appointments/${appointmentId}`).once('value');
        const appointment = snapshot.val();
        
        if (!appointment) {
            showNotification('Appointment not found', 'error');
            return;
        }
        
        await database.ref(`appointmentArchive/${appointmentId}`).set({
            ...appointment,
            archivedAt: new Date().toISOString()
        });
        
        await database.ref(`appointments/${appointmentId}`).remove();
        
        showNotification('Appointment moved to archive successfully!', 'success');
        loadAppointmentArchive();
        loadAllAppointments();
        
    } catch (error) {
        console.error('Error moving to archive:', error);
        showNotification('Error archiving appointment', 'error');
    }
}

window.deleteArchivedAppointment = async function(appointmentId, source = 'current') {
    if (!confirm('Delete this appointment permanently?')) {
        return;
    }

    try {
        if (source === 'archive') {
            await database.ref(`appointmentArchive/${appointmentId}`).remove();
        } else {
            await database.ref(`appointments/${appointmentId}`).remove();
        }
        
        showNotification('Appointment deleted successfully!', 'success');
        loadAppointmentArchive();
        loadAllAppointments();
    } catch (error) {
        console.error('Error deleting appointment:', error);
        showNotification('Error deleting appointment', 'error');
    }
}

window.deleteAllArchived = async function() {
    if (!confirm('Permanently delete ALL archived appointments? This cannot be undone!')) {
        return;
    }

    try {
        const snapshot = await database.ref('appointmentArchive').once('value');
        const archive = snapshot.val() || {};
        
        const deletePromises = Object.keys(archive).map(appointmentId => 
            database.ref(`appointmentArchive/${appointmentId}`).remove()
        );
        
        await Promise.all(deletePromises);
        showNotification('All archived appointments deleted!', 'success');
        loadAppointmentArchive();
        
    } catch (error) {
        console.error('Error deleting all archived:', error);
        showNotification('Error deleting archived appointments', 'error');
    }
}

window.exportArchiveData = function() {
    showNotification('Export feature coming soon!', 'info');
}

// ===== IMAGE MANAGEMENT =====
async function loadImages() {
    try {
        const snapshot = await database.ref('images').once('value');
        const images = snapshot.val() || {};
        
        if (images.logo) {
            const logoSrc = images.logo.base64 || images.logo.url;
            if (logoSrc) {
                document.querySelector('#logoPreview img').src = logoSrc;
            }
        }
        
        if (images.doctorIllustration) {
            const doctorSrc = images.doctorIllustration.base64 || images.doctorIllustration.url;
            if (doctorSrc) {
                document.querySelector('#doctorIllustrationPreview img').src = doctorSrc;
            }
        }
        
    } catch (error) {
        console.error('Error loading images:', error);
    }
}

window.uploadImage = async function(type, inputId) {
    const fileInput = document.getElementById(inputId);
    const file = fileInput.files[0];

    if (!file) {
        showNotification("Please select a file first.", "error");
        return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        showNotification("File too large! Maximum size is 5MB.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64String = e.target.result;

        try {
            await database.ref(`images/${type}`).set({
                base64: base64String,
                name: file.name,
                updatedAt: new Date().toISOString()
            });

            const preview = document.querySelector(`#${type}Preview img`);
            if (preview) {
                preview.src = base64String;
            }

            showNotification("Image uploaded successfully!", "success");
            loadImages();
            loadDashboardData();

        } catch (error) {
            console.error("Error uploading image:", error);
            showNotification("Failed to upload image.", "error");
        }
    };

    reader.readAsDataURL(file);
}

// ===== UNIFIED CONTENT MANAGEMENT =====
async function loadUnifiedContent() {
    try {
        const [contentSnapshot, aboutSnapshot, footerSnapshot, specialtiesSnapshot, servicesSnapshot] = await Promise.all([
            database.ref('content').once('value'),
            database.ref('aboutSection').once('value'),
            database.ref('footerContent').once('value'),
            database.ref('specialties').once('value'),
            database.ref('specialtyServices').once('value')
        ]);

        const content = contentSnapshot.val() || {};
        const aboutSection = aboutSnapshot.val() || {};
        const footerContent = footerSnapshot.val() || {};
        const specialties = specialtiesSnapshot.val() || {};
        const specialtyServices = servicesSnapshot.val() || {};

        populateContentFields(content, aboutSection, footerContent, specialties, specialtyServices);
        
    } catch (error) {
        console.error('Error loading unified content:', error);
        showNotification('Error loading content', 'error');
    }
}

function populateContentFields(content, aboutSection, footerContent, specialties, specialtyServices) {
    // Hero Section
    if (content.hero) {
        document.getElementById('heroHeading').value = content.hero.heading || '';
        document.getElementById('heroDescription').value = content.hero.description || '';
        document.getElementById('heroButtonText').value = content.hero.buttonText || 'Book Appointment';
    }

    // Contact Information
    if (content.contact) {
        document.getElementById('contactAddress').value = content.contact.address || '';
        document.getElementById('contactPhone').value = content.contact.phone || '';
        document.getElementById('contactEmail').value = content.contact.email || '';
    }

    // About Section
    if (aboutSection.heading) {
        document.getElementById('aboutHeading').value = aboutSection.heading || '';
        document.getElementById('aboutSubheading').value = aboutSection.subheading || '';
        document.getElementById('aboutDescription').value = aboutSection.description || '';
    }

    // Load about features
    loadAboutFeatures(aboutSection.features || []);

    // Footer Content
    if (footerContent.copyright) {
        document.getElementById('footerCopyright').value = footerContent.copyright || '';
    }

    // Load specialties for management
    loadSpecialtiesForManagement(specialties, specialtyServices);
}

// ===== ABOUT SECTION FEATURES MANAGEMENT =====
function loadAboutFeatures(features) {
    const container = document.getElementById('aboutFeaturesList');
    
    if (!features || features.length === 0) {
        container.innerHTML = '<p class="text-muted">No features added yet. Add your first feature below.</p>';
        return;
    }

    let html = '<div class="list-group mb-3">';
    features.forEach((feature, index) => {
        html += `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <i class="fas fa-check-circle text-primary me-2"></i>
                    <span>${feature}</span>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="removeAboutFeature(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

window.addAboutFeature = async function() {
    const input = document.getElementById('newAboutFeature');
    const featureText = input.value.trim();

    if (!featureText) {
        showNotification('Please enter a feature text', 'error');
        return;
    }

    try {
        const snapshot = await database.ref('aboutSection/features').once('value');
        const features = snapshot.val() || [];
        
        features.push(featureText);
        
        await database.ref('aboutSection/features').set(features);
        
        showNotification('Feature added successfully!', 'success');
        input.value = '';
        loadUnifiedContent();
        
    } catch (error) {
        console.error('Error adding feature:', error);
        showNotification('Error adding feature', 'error');
    }
}

window.removeAboutFeature = async function(index) {
    if (!confirm('Remove this feature?')) {
        return;
    }

    try {
        const snapshot = await database.ref('aboutSection/features').once('value');
        const features = snapshot.val() || [];
        
        features.splice(index, 1);
        
        await database.ref('aboutSection/features').set(features);
        
        showNotification('Feature removed successfully!', 'success');
        loadUnifiedContent();
        
    } catch (error) {
        console.error('Error removing feature:', error);
        showNotification('Error removing feature', 'error');
    }
}

window.saveAllContent = async function() {
    const saveButton = document.getElementById('saveAllContentBtn');
    const originalText = saveButton.innerHTML;
    
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Saving...';
    saveButton.disabled = true;

    try {
        const contentData = {
            hero: {
                heading: document.getElementById('heroHeading').value,
                description: document.getElementById('heroDescription').value,
                buttonText: document.getElementById('heroButtonText').value || 'Book Appointment',
                updatedAt: new Date().toISOString()
            },
            contact: {
                address: document.getElementById('contactAddress').value,
                phone: document.getElementById('contactPhone').value,
                email: document.getElementById('contactEmail').value,
                updatedAt: new Date().toISOString()
            }
        };

        const aboutData = {
            heading: document.getElementById('aboutHeading').value,
            subheading: document.getElementById('aboutSubheading').value,
            description: document.getElementById('aboutDescription').value,
            updatedAt: new Date().toISOString()
        };

        const footerData = {
            copyright: document.getElementById('footerCopyright').value,
            updatedAt: new Date().toISOString()
        };

        await Promise.all([
            database.ref('content').update(contentData),
            database.ref('aboutSection').update(aboutData),
            database.ref('footerContent').set(footerData)
        ]);

        showNotification('All content saved successfully!', 'success');
        
    } catch (error) {
        console.error('Error saving content:', error);
        showNotification('Error saving content', 'error');
    } finally {
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
    }
}

// ===== SPECIALTY MANAGEMENT =====
async function loadSpecialtiesForManagement(specialties, specialtyServices) {
    const container = document.getElementById('specialtiesManagementList');
    if (!container) return;

    let html = '';
    const specialtiesArray = Object.entries(specialties).map(([id, data]) => ({
        id,
        name: data.name || data,
        createdAt: data.addedAt || ''
    }));

    if (specialtiesArray.length === 0) {
        html = '<div class="text-center text-muted p-3">No specialties added yet.</div>';
    } else {
        const doctorsSnapshot = await database.ref('doctors').once('value');
        const doctors = doctorsSnapshot.val() || {};
        
        specialtiesArray.forEach(specialty => {
            const doctorCount = Object.values(doctors).filter(doctor => 
                doctor.specialty === specialty.name
            ).length;
            
            const hasServices = specialtyServices && specialtyServices[specialty.name];
            
            html += `
                <div class="specialty-management-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <i class="fas fa-stethoscope me-2 text-primary"></i>
                            <strong>${specialty.name}</strong>
                            <span class="badge bg-info ms-2">${doctorCount} doctor(s)</span>
                            ${hasServices ? '<span class="badge bg-success ms-1"><i class="fas fa-check"></i> Services Configured</span>' : ''}
                            ${specialty.createdAt ? `<small class="text-muted ms-2">Added: ${new Date(specialty.createdAt).toLocaleDateString()}</small>` : ''}
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-info me-1" onclick="manageSpecialtyServices('${specialty.name}')">
                                <i class="fas fa-cog"></i> Services
                            </button>
                            <button class="btn btn-sm btn-outline-warning me-1" onclick="editSpecialty('${specialty.id}', '${specialty.name}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteSpecialtyWithConfirmation('${specialty.id}', '${specialty.name}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;
}

window.deleteSpecialtyWithConfirmation = async function(specialtyId, specialtyName) {
    // Enhanced confirmation
    const confirmation = confirm(`Are you sure you want to delete the specialty "${specialtyName}"?\n\nThis will:\n• Remove it from specialty filters\n• Affect doctors with this specialty\n• Remove it from frontend display\n\nThis action cannot be undone.`);
    
    if (!confirmation) {
        return;
    }

    try {
        // Check if any doctors have this specialty
        const doctorsSnapshot = await database.ref('doctors').once('value');
        const doctors = doctorsSnapshot.val() || {};
        const doctorsWithSpecialty = Object.entries(doctors).filter(([id, doctor]) => 
            doctor.specialty === specialtyName
        );
        
        if (doctorsWithSpecialty.length > 0) {
            const doctorNames = doctorsWithSpecialty.map(([id, doctor]) => doctor.name).join(', ');
            const proceed = confirm(`Warning: ${doctorsWithSpecialty.length} doctor(s) have this specialty:\n\n${doctorNames}\n\nThey will need to be reassigned to another specialty.\n\nContinue with deletion?`);
            
            if (!proceed) {
                showNotification('Specialty deletion cancelled', 'info');
                return;
            }
        }
        
        // Remove the specialty
        await database.ref(`specialties/${specialtyId}`).remove();
        
        // Also remove associated services
        await database.ref(`specialtyServices/${specialtyName}`).remove();
        
        showNotification(`Specialty "${specialtyName}" deleted successfully!`, 'success');
        loadUnifiedContent();
        loadSpecialtiesForDropdown();
        loadSpecialtyFilters();
        
    } catch (error) {
        console.error('Error deleting specialty:', error);
        showNotification('Error deleting specialty: ' + error.message, 'error');
    }
};

window.addSpecialty = async function() {
    const input = document.getElementById('newSpecialtyInput');
    const specialtyName = input.value.trim();

    if (!specialtyName) {
        showNotification('Please enter a specialty name', 'error');
        return;
    }

    try {
        await database.ref('specialties').push({
            name: specialtyName,
            addedAt: new Date().toISOString()
        });

        showNotification('Specialty added successfully!', 'success');
        input.value = '';
        loadUnifiedContent();
        loadSpecialtiesForDropdown();
        loadSpecialtyFilters();

    } catch (error) {
        console.error('Error adding specialty:', error);
        showNotification('Error adding specialty', 'error');
    }
}

window.editSpecialty = async function(specialtyId, currentName) {
    const newName = prompt('Edit specialty name:', currentName);
    
    if (!newName || newName.trim() === '' || newName === currentName) {
        return;
    }

    try {
        await database.ref(`specialties/${specialtyId}`).update({
            name: newName.trim(),
            updatedAt: new Date().toISOString()
        });

        showNotification(`Specialty updated to "${newName}"!`, 'success');
        loadUnifiedContent();
        loadSpecialtiesForDropdown();
        loadSpecialtyFilters();
        
    } catch (error) {
        console.error('Error updating specialty:', error);
        showNotification('Error updating specialty', 'error');
    }
}

// ===== ENHANCED SERVICES/SPECIALTIES CUSTOMIZATION =====
window.manageSpecialtyServices = async function(specialtyName) {
    try {
        const snapshot = await database.ref(`specialtyServices/${specialtyName}`).once('value');
        const services = snapshot.val() || {
            description: `Comprehensive care for ${specialtyName.toLowerCase()}`, 
            services: ['Service 1', 'Service 2', 'Service 3'],
            badge: `${specialtyName} Care`
        };
        
        showSpecialtyServicesModal(specialtyName, services);
    } catch (error) {
        console.error('Error loading specialty services:', error);
        showNotification('Error loading services', 'error');
    }
};

function showSpecialtyServicesModal(specialtyName, services) {
    const modalContent = `
        <div class="specialty-services-management">
            <div class="mb-3">
                <label class="form-label">Specialty Description</label>
                <textarea class="form-control" id="specialtyDescription" rows="3">${services.description}</textarea>
            </div>
            
            <div class="mb-3">
                <label class="form-label">Services Offered (one per line)</label>
                <textarea class="form-control" id="specialtyServicesList" rows="5">${Array.isArray(services.services) ? services.services.join('\n') : services.services}</textarea>
                <div class="form-text">Enter each service on a new line</div>
            </div>
            
            <div class="mb-3">
                <label class="form-label">Badge Text</label>
                <input type="text" class="form-control" id="specialtyBadge" value="${services.badge}">
            </div>
            
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                These changes will appear on the frontend services section
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('specialtyServicesModal');
    if (existingModal) existingModal.remove();
    
    const modalHTML = `
        <div class="modal fade" id="specialtyServicesModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Manage Services for ${specialtyName}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${modalContent}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="saveSpecialtyServices('${specialtyName}')">
                            <i class="fas fa-save me-1"></i> Save Services
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('specialtyServicesModal'));
    modal.show();
}

window.saveSpecialtyServices = async function(specialtyName) {
    try {
        const description = document.getElementById('specialtyDescription').value;
        const servicesList = document.getElementById('specialtyServicesList').value;
        const badge = document.getElementById('specialtyBadge').value;
        
        const services = {
            description: description,
            services: servicesList.split('\n').filter(s => s.trim() !== ''),
            badge: badge,
            updatedAt: new Date().toISOString()
        };
        
        await database.ref(`specialtyServices/${specialtyName}`).set(services);
        
        showNotification(`Services for ${specialtyName} updated successfully!`, 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('specialtyServicesModal'));
        modal.hide();
        
    } catch (error) {
        console.error('Error saving specialty services:', error);
        showNotification('Error saving services', 'error');
    }
};

// ===== DOCTOR MANAGEMENT =====
async function loadDoctors() {
    const container = document.getElementById('doctorsList');
    container.innerHTML = '<div class="col-12 text-center"><p>Loading doctors...</p></div>';

    try {
        const snapshot = await database.ref('doctors').once('value');
        const doctors = snapshot.val() || {};
        let doctorsArray = Object.entries(doctors).map(([id, data]) => ({
            id,
            ...data
        }));

        if (currentSpecialtyFilter !== 'all') {
            doctorsArray = doctorsArray.filter(doctor => 
                doctor.specialty === currentSpecialtyFilter
            );
        }

        if (doctorsArray.length === 0) {
            if (currentSpecialtyFilter === 'all') {
                container.innerHTML = '<div class="col-12 text-center"><p class="text-muted">No doctors added yet.</p></div>';
            } else {
                container.innerHTML = `<div class="col-12 text-center"><p class="text-muted">No doctors found for ${currentSpecialtyFilter}.</p></div>`;
            }
            return;
        }

        let html = '';
        // Inside loadDoctors() function, after the doctorsArray.forEach loop starts:

doctorsArray.forEach(doctor => {
    const currentHour = new Date().getHours();
    let availabilityBadge = '';
    
    if (doctor.shiftStart && doctor.shiftEnd) {
        const shiftStart = parseInt(doctor.shiftStart.split(':')[0]);
        const shiftEnd = parseInt(doctor.shiftEnd.split(':')[0]);
        
        let isAvailable = false;
        if (shiftStart > shiftEnd) {
            isAvailable = currentHour >= shiftStart || currentHour < shiftEnd;
        } else {
            isAvailable = currentHour >= shiftStart && currentHour < shiftEnd;
        }
        
        if (isAvailable) {
            availabilityBadge = '<span class="badge availability-badge bg-success"><i class="fas fa-check-circle me-1"></i>Available Now</span>';
        } else {
            availabilityBadge = '<span class="badge availability-badge bg-danger"><i class="fas fa-times-circle me-1"></i>Off Duty</span>';
        }
    }
    
    const shiftInfo = doctor.shiftStart && doctor.shiftEnd 
        ? `${formatTime(doctor.shiftStart)} - ${formatTime(doctor.shiftEnd)}`
        : 'No shift set';
    
    // Escape special characters in doctor name for safe JavaScript
    const escapedName = (doctor.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    
    // NEW HTML STRUCTURE - Replace the old one with this:
    // In the doctor card HTML generation, make sure the delete button uses the correct ID
html += `
    <div class="col-md-6 col-lg-4">
        <div class="doctor-card">
            <!-- Availability Badge -->
            ${availabilityBadge}
            
            <div class="doctor-icon">
                <i class="fas fa-user-md"></i>
            </div>
            
            <div class="doctor-info">
                <h5 class="doctor-name">${doctor.name}</h5>
                <p class="doctor-specialty">${doctor.specialty}</p>
                <p class="doctor-shift">
                    <i class="fas fa-clock me-1"></i>${shiftInfo}
                </p>
            </div>
            
            <!-- Appointment Count Badge -->
            <div class="doctor-badges-container">
                <span class="badge appointment-count-badge bg-info" id="appointmentCount-${doctor.id}">
                    <i class="fas fa-calendar me-1"></i>
                    Loading...
                </span>
            </div>
            
            <p class="doctor-id"><strong>ID:</strong> ${doctor.id}</p>
            
            <div class="doctor-actions">
                <button class="btn btn-sm btn-info" onclick="viewDoctorAppointments('${doctor.id}', '${escapedName}')" title="View Appointments">
                    <i class="fas fa-eye me-1"></i> Appointments
                </button>
                <button class="btn btn-sm btn-primary" onclick="editDoctor('${doctor.id}', '${escapedName}', '${doctor.specialty}', '${doctor.shiftStart || ''}', '${doctor.shiftEnd || ''}')" title="Edit">
                    <i class="fas fa-edit me-1"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteDoctor('${doctor.id}', '${escapedName}')" title="Remove">
                    <i class="fas fa-trash me-1"></i> Remove
                </button>
            </div>
        </div>
    </div>
`;
});

        container.innerHTML = html;
        loadDoctorAppointmentCounts();

    } catch (error) {
        console.error('Error loading doctors:', error);
        container.innerHTML = '<div class="col-12 text-center"><p class="text-danger">Error loading doctors.</p></div>';
    }
}

// ===== IMPROVED DOCTOR APPOINTMENT COUNT LOADING =====
async function loadDoctorAppointmentCounts() {
    try {
        const [appointmentsSnapshot, doctorsSnapshot] = await Promise.all([
            database.ref('appointments').once('value'),
            database.ref('doctors').once('value')
        ]);
        
        const appointments = appointmentsSnapshot.val() || {};
        const doctors = doctorsSnapshot.val() || {};
        const today = new Date().toISOString().split('T')[0];
        
        Object.keys(doctors).forEach(doctorId => {
            const countElement = document.getElementById(`appointmentCount-${doctorId}`);
            if (countElement) {
                // Count TODAY'S appointments only (not upcoming)
                const todaysAppointments = Object.values(appointments)
                    .filter(appt => 
                        appt.doctor === doctorId && 
                        appt.date === today && // Only today's date
                        appt.status !== 'cancelled' &&
                        appt.status !== 'expired'
                    )
                    .length;
                
                // Count upcoming appointments (for display)
                const upcomingAppointments = Object.values(appointments)
                    .filter(appt => 
                        appt.doctor === doctorId && 
                        appt.date >= today &&
                        appt.status !== 'cancelled' &&
                        appt.status !== 'expired'
                    )
                    .length;
                
                countElement.textContent = `${upcomingAppointments} upcoming (${todaysAppointments} today)`;
                
                // Update badge color based on TODAY'S appointment count
                const badgeElement = countElement.parentElement;
                if (todaysAppointments >= MAX_APPOINTMENTS_PER_DOCTOR_PER_DAY) {
                    badgeElement.className = 'badge appointment-count-badge bg-danger';
                } else if (todaysAppointments >= MAX_APPOINTMENTS_PER_DOCTOR_PER_DAY - 1) {
                    badgeElement.className = 'badge appointment-count-badge bg-warning';
                } else {
                    badgeElement.className = 'badge appointment-count-badge bg-info';
                }
            }
        });
    } catch (error) {
        console.error('Error loading appointment counts:', error);
    }
}

window.editDoctor = function(doctorId, name, specialty, shiftStart, shiftEnd) {
    console.log('Editing doctor:', { doctorId, name, specialty, shiftStart, shiftEnd });
    
    // Set modal title
    document.getElementById('doctorModalTitle').textContent = 'Edit Doctor';
    
    // Set form values with null checks
    document.getElementById('doctorName').value = name || '';
    document.getElementById('doctorSpecialty').value = specialty || '';
    document.getElementById('doctorShiftStart').value = shiftStart || '';
    document.getElementById('doctorShiftEnd').value = shiftEnd || '';
    document.getElementById('doctorId').value = doctorId;
    
    // Validate shift if both times are provided
    if (shiftStart && shiftEnd) {
        validateShift();
    }

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('addDoctorModal'));
    modal.show();
};

window.saveDoctor = async function() {
    // Get form values with null checks
    const name = document.getElementById('doctorName')?.value || '';
    const specialty = document.getElementById('doctorSpecialty')?.value || '';
    const shiftStart = document.getElementById('doctorShiftStart')?.value || '';
    const shiftEnd = document.getElementById('doctorShiftEnd')?.value || '';
    const id = document.getElementById('doctorId')?.value || '';

    console.log('Saving doctor:', { name, specialty, shiftStart, shiftEnd, id });

    // Validation
    if (!name || !specialty || !shiftStart || !shiftEnd) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    // Validate 12-hour shift
    const start = parseInt(shiftStart.split(':')[0]);
    const end = parseInt(shiftEnd.split(':')[0]);
    let duration = end - start;
    if (duration < 0) duration += 24;
    
    if (duration !== 12) {
        showNotification('Shift must be exactly 12 hours!', 'error');
        return;
    }

    try {
        const doctorData = {
            name,
            specialty,
            shiftStart,
            shiftEnd,
            updatedAt: new Date().toISOString()
        };
        
        if (id) {
            // Update existing doctor
            await database.ref(`doctors/${id}`).update(doctorData);
            showNotification('Doctor updated successfully!', 'success');
        } else {
            // Add new doctor
            const customId = generateDoctorId(name);
            await database.ref(`doctors/${customId}`).set({
                ...doctorData,
                addedAt: new Date().toISOString()
            });
            showNotification(`Doctor added successfully with ID: ${customId}`, 'success');
        }

        // Close modal and reset form
        const modal = bootstrap.Modal.getInstance(document.getElementById('addDoctorModal'));
        modal.hide();
        
        document.getElementById('addDoctorForm').reset();
        document.getElementById('doctorId').value = "";
        document.getElementById('doctorModalTitle').textContent = 'Add New Doctor';

        // Reload data
        loadDoctors();
        loadDashboardData();

    } catch (error) {
        console.error('Error saving doctor:', error);
        showNotification('Error saving doctor: ' + error.message, 'error');
    }
};

window.deleteDoctor = async function(doctorId, doctorName) {
    // Enhanced confirmation with doctor name
    const confirmation = confirm(`Are you sure you want to remove "${doctorName || doctorId}"?\n\nThis will:\n• Remove the doctor from the system\n• Remove them from the frontend doctor list\n• Their past appointments will remain in the system\n\nThis action cannot be undone.`);
    
    if (!confirmation) {
        return;
    }
    
    // Additional safety check for accidental clicks
    const finalConfirmation = confirm(`Final confirmation: Delete "${doctorName || doctorId}"?`);
    
    if (!finalConfirmation) {
        return;
    }
    
    try {
        // Check if doctor has upcoming appointments
        const appointmentsSnapshot = await database.ref('appointments').once('value');
        const appointments = appointmentsSnapshot.val() || {};
        const today = new Date().toISOString().split('T')[0];
        
        const upcomingAppointments = Object.values(appointments).filter(apt => 
            apt.doctor === doctorId && 
            apt.date >= today &&
            apt.status !== 'cancelled'
        );
        
        if (upcomingAppointments.length > 0) {
            const proceed = confirm(`Warning: This doctor has ${upcomingAppointments.length} upcoming appointment(s).\n\nDo you still want to remove this doctor?\n\nNote: The appointments will remain in the system but the doctor will be removed.`);
            
            if (!proceed) {
                return;
            }
        }
        
        // Remove the doctor
        await database.ref(`doctors/${doctorId}`).remove();
        
        showNotification(`Doctor "${doctorName || doctorId}" removed successfully!`, 'success');
        loadDoctors();
        loadDashboardData();
        loadSpecialtiesForDropdown();
        
    } catch (error) {
        console.error('Error deleting doctor:', error);
        showNotification('Error removing doctor: ' + error.message, 'error');
    }
}

// ===== SPECIALTY FILTERS & DROPDOWN =====
async function loadSpecialtyFilters() {
    const filterContainer = document.getElementById('specialtyFilters');
    if (!filterContainer) return;

    try {
        const specialtiesSnapshot = await database.ref('specialties').once('value');
        const specialties = specialtiesSnapshot.val() || {};
        
        let html = `
            <div class="mb-3">
                <strong>Filter by Specialty:</strong>
                <div class="d-flex flex-wrap gap-2 mt-2">
                    <button class="btn btn-sm ${currentSpecialtyFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'}" onclick="filterDoctorsBySpecialty('all')">
                        All Specialties
                    </button>
        `;

        Object.values(specialties).forEach(specialty => {
            const specialtyName = specialty.name || specialty;
            const isActive = currentSpecialtyFilter === specialtyName;
            html += `
                <button class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-primary'}" onclick="filterDoctorsBySpecialty('${specialtyName}')">
                    ${specialtyName}
                </button>
            `;
        });

        html += `
                </div>
            </div>
        `;

        filterContainer.innerHTML = html;

    } catch (error) {
        console.error('Error loading specialty filters:', error);
        filterContainer.innerHTML = '<div class="text-muted">Error loading filters</div>';
    }
}

window.filterDoctorsBySpecialty = function(specialty) {
    currentSpecialtyFilter = specialty;
    loadDoctors();
    loadSpecialtyFilters();
}

async function loadSpecialtiesForDropdown() {
    const dropdown = document.getElementById('doctorSpecialty');
    if (!dropdown) return;

    try {
        const snapshot = await database.ref('specialties').once('value');
        const specialties = snapshot.val() || {};

        dropdown.innerHTML = '<option value="">Select Specialty</option>';

        Object.values(specialties).forEach(specialty => {
            const option = document.createElement('option');
            option.value = specialty.name || specialty;
            option.textContent = specialty.name || specialty;
            dropdown.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading specialties for dropdown:', error);
        dropdown.innerHTML = `
            <option value="">Select Specialty</option>
            <option value="General Medicine">General Medicine</option>
            <option value="Pediatrics">Pediatrics</option>
            <option value="Internal Medicine">Internal Medicine</option>
            <option value="Family Medicine">Family Medicine</option>
        `;
    }
}

// ===== DIAGNOSTIC FUNCTIONS =====
window.checkFirebasePermissions = async function() {
    console.log('=== Checking Firebase Permissions ===');
    
    try {
        // Check authentication
        const user = auth.currentUser;
        if (!user) {
            console.error('❌ Not authenticated');
            showNotification('You must be logged in to perform this action', 'error');
            return false;
        }
        console.log('✅ Authenticated as:', user.email);
        
        // Test read permission
        try {
            const testRead = await database.ref('doctors').once('value');
            console.log('✅ Read permission: OK');
        } catch (error) {
            console.error('❌ Read permission: DENIED', error);
            showNotification('Read permission denied. Check Firebase rules.', 'error');
            return false;
        }
        
        // Test write permission
        try {
            await database.ref('.info/connected').once('value');
            console.log('✅ Connected to Firebase');
        } catch (error) {
            console.error('❌ Connection error:', error);
            showNotification('Cannot connect to Firebase', 'error');
            return false;
        }
        
        showNotification('Firebase permissions check passed!', 'success');
        return true;
        
    } catch (error) {
        console.error('Error checking permissions:', error);
        showNotification('Error checking permissions: ' + error.message, 'error');
        return false;
    }
};

window.deleteDoctor = async function(doctorId, doctorName) {
    console.log('Delete attempt:', { doctorId, doctorName });
    
    // Enhanced confirmation with doctor name
    const confirmation = confirm(`Are you sure you want to remove "${doctorName || doctorId}"?\n\nThis will:\n• Remove the doctor from the system\n• Remove them from the frontend doctor list\n• Their past appointments will remain in the system\n\nThis action cannot be undone.`);
    
    if (!confirmation) {
        console.log('Delete cancelled by user');
        return;
    }
    
    // Additional safety check for accidental clicks
    const finalConfirmation = confirm(`Final confirmation: Delete "${doctorName || doctorId}"?`);
    
    if (!finalConfirmation) {
        console.log('Delete cancelled in final confirmation');
        return;
    }
    
    // Show loading state
    const deleteButtons = document.querySelectorAll(`button[onclick*="${doctorId}"]`);
    deleteButtons.forEach(btn => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    });
    
    try {
        console.log('Starting delete process for doctor:', doctorId);
        
        // Check Firebase permissions first
        const user = auth.currentUser;
        if (!user) {
            throw new Error('You must be logged in to perform this action');
        }
        
        // Check if doctor exists
        const doctorSnapshot = await database.ref(`doctors/${doctorId}`).once('value');
        if (!doctorSnapshot.exists()) {
            throw new Error('Doctor not found in database');
        }
        console.log('Doctor found in database, proceeding with deletion');
        
        // Check if doctor has upcoming appointments
        const appointmentsSnapshot = await database.ref('appointments').once('value');
        const appointments = appointmentsSnapshot.val() || {};
        const today = new Date().toISOString().split('T')[0];
        
        const upcomingAppointments = Object.values(appointments).filter(apt => 
            apt.doctor === doctorId && 
            apt.date >= today &&
            apt.status !== 'cancelled'
        );
        
        console.log('Upcoming appointments found:', upcomingAppointments.length);
        
        if (upcomingAppointments.length > 0) {
            const appointmentDetails = upcomingAppointments.map(apt => 
                `${apt.name} on ${apt.date} at ${apt.time}`
            ).join('\n');
            
            const proceed = confirm(`Warning: This doctor has ${upcomingAppointments.length} upcoming appointment(s):\n\n${appointmentDetails}\n\nDo you still want to remove this doctor?\n\nNote: The appointments will remain in the system but the doctor will be removed.`);
            
            if (!proceed) {
                console.log('Delete cancelled due to upcoming appointments');
                // Restore button state
                deleteButtons.forEach(btn => {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-trash me-1"></i> Remove';
                });
                return;
            }
        }
        
        // Remove the doctor from Firebase
        console.log('Attempting to remove doctor from Firebase...');
        await database.ref(`doctors/${doctorId}`).remove();
        
        // Verify deletion
        const verifySnapshot = await database.ref(`doctors/${doctorId}`).once('value');
        if (!verifySnapshot.exists()) {
            console.log('✅ Doctor successfully deleted from database');
            showNotification(`Doctor "${doctorName || doctorId}" removed successfully!`, 'success');
            
            // Reload the doctors list
            loadDoctors();
            loadDashboardData();
            loadSpecialtiesForDropdown();
        } else {
            throw new Error('Doctor still exists after deletion attempt');
        }
        
    } catch (error) {
        console.error('❌ Error deleting doctor:', error);
        
        let errorMessage = 'Error removing doctor: ' + error.message;
        
        // Specific error handling
        if (error.message.includes('permission_denied')) {
            errorMessage = 'Permission denied. You may not have rights to delete doctors. Check Firebase rules.';
        } else if (error.message.includes('not found')) {
            errorMessage = 'Doctor not found in database.';
        }
        
        showNotification(errorMessage, 'error');
        
        // Restore button state on error
        deleteButtons.forEach(btn => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-trash me-1"></i> Remove';
        });
    }
};

// ===== UTILITY FUNCTIONS =====
function setupShiftValidation() {
    const shiftStart = document.getElementById('doctorShiftStart');
    const shiftEnd = document.getElementById('doctorShiftEnd');
    
    if (shiftStart && shiftEnd) {
        shiftStart.addEventListener('change', validateShift);
        shiftEnd.addEventListener('change', validateShift);
    } else {
        console.warn('Shift time elements not found');
    }
}

function validateShift() {
    const shiftStart = document.getElementById('doctorShiftStart')?.value;
    const shiftEnd = document.getElementById('doctorShiftEnd')?.value;
    const validationDiv = document.getElementById('shiftDuration');
    const saveBtn = document.getElementById('saveDoctorBtn');
    
    if (!shiftStart || !shiftEnd) {
        if (validationDiv) {
            validationDiv.textContent = 'Please select both start and end times';
            validationDiv.parentElement.className = 'alert alert-info';
        }
        if (saveBtn) saveBtn.disabled = true;
        return;
    }
    
    const start = parseInt(shiftStart.split(':')[0]);
    const end = parseInt(shiftEnd.split(':')[0]);
    
    let duration = end - start;
    if (duration < 0) duration += 24;
    
    if (validationDiv) {
        if (duration === 12) {
            validationDiv.innerHTML = `<i class="fas fa-check-circle me-2"></i> Valid 12-hour shift: ${formatTime(shiftStart)} - ${formatTime(shiftEnd)}`;
            validationDiv.parentElement.className = 'alert alert-success';
            if (saveBtn) saveBtn.disabled = false;
        } else {
            validationDiv.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> Shift must be exactly 12 hours (currently ${duration} hours)`;
            validationDiv.parentElement.className = 'alert alert-danger';
            if (saveBtn) saveBtn.disabled = true;
        }
    }
}

function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${displayHour}:${minutes || '00'} ${period}`;
}

function formatDisplayDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
}

function generateDoctorId(doctorName) {
    return doctorName
        .toLowerCase()
        .replace(/dr\.?\s*/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

async function checkDoctorAvailability() {
    try {
        const doctorsSnapshot = await database.ref('doctors').once('value');
        const doctors = doctorsSnapshot.val() || {};
        
        const currentHour = new Date().getHours();
        const unavailableDoctors = [];
        
        Object.entries(doctors).forEach(([id, doctor]) => {
            if (doctor.shiftStart && doctor.shiftEnd) {
                const shiftStart = parseInt(doctor.shiftStart.split(':')[0]);
                const shiftEnd = parseInt(doctor.shiftEnd.split(':')[0]);
                
                let isAvailable = false;
                if (shiftStart > shiftEnd) {
                    isAvailable = currentHour >= shiftStart || currentHour < shiftEnd;
                } else {
                    isAvailable = currentHour >= shiftStart && currentHour < shiftEnd;
                }
                
                if (!isAvailable) {
                    unavailableDoctors.push({
                        name: doctor.name,
                        shift: `${formatTime(doctor.shiftStart)} - ${formatTime(doctor.shiftEnd)}`
                    });
                }
            }
        });
        
        if (unavailableDoctors.length > 0) {
            const names = unavailableDoctors.map(d => `${d.name} (${d.shift})`).join(', ');
            showNotification(`⚠️ Currently unavailable: ${names}`, 'info');
        }
        
    } catch (error) {
        console.error('Error checking doctor availability:', error);
    }
}

function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="badge badge-pending">Pending</span>',
        'confirmed': '<span class="badge badge-confirmed">Confirmed</span>',
        'cancelled': '<span class="badge badge-cancelled">Cancelled</span>',
        'expired': '<span class="badge bg-secondary">Expired</span>'
    };
    return badges[status] || badges['pending'];
}

function showNotification(message, type = 'success') {
    const toastElement = document.getElementById('notificationToast');
    
    let target = toastElement.querySelector('.toast-body');
    if (!target) {
        target = toastElement.querySelector('.toast-header strong');
    }
    if (target) target.textContent = message;

    toastElement.classList.remove('bg-success', 'bg-danger', 'bg-info');
    if (type === 'success') toastElement.classList.add('bg-success', 'text-white');
    if (type === 'error') toastElement.classList.add('bg-danger', 'text-white');
    if (type === 'info') toastElement.classList.add('bg-info', 'text-white');

    const toast = new bootstrap.Toast(toastElement);
    toast.show();
}
// Add this to see all doctor IDs
window.listAllDoctors = async function() {
    try {
        const snapshot = await database.ref('doctors').once('value');
        const doctors = snapshot.val() || {};
        
        console.log('=== ALL DOCTORS IN DATABASE ===');
        Object.keys(doctors).forEach(id => {
            console.log(`ID: "${id}" | Name: ${doctors[id].name}`);
        });
        
        return doctors;
    } catch (error) {
        console.error('Error listing doctors:', error);
    }

// Global scroll position preservation
let currentScrollPosition = 0;

function saveScrollPosition() {
    currentScrollPosition = window.scrollY || document.documentElement.scrollTop;
}

function restoreScrollPosition() {
    window.scrollTo({
        top: currentScrollPosition,
        behavior: 'auto'
    });
}

// Save scroll position before any async operations
window.addEventListener('beforeunload', saveScrollPosition);

// Override the default button behavior
document.addEventListener('click', function(e) {
    if (e.target.matches('.filter-btn, .action-buttons .btn, [onclick*="updateAppointmentStatus"], [onclick*="viewAppointmentDetails"]')) {
        saveScrollPosition();
    }
});

// Add CSS to prevent focus outlines from causing scroll
const scrollFixStyle = document.createElement('style');
scrollFixStyle.textContent = `
    .filter-btn:focus,
    .action-buttons .btn:focus {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
    
    .filter-btn {
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
    }
    
    .filter-btn.active {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    
    #appointmentsTableBody tr {
        transition: opacity 0.3s ease;
    }
`;
document.head.appendChild(scrollFixStyle);

};

