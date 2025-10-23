$(document).ready(function() {
    let currentUniqueCode = '';
    
    // Generate unique code
    $('#generateCode').click(function() {
        $.get('/api/generate-code', function(response) {
            currentUniqueCode = response.uniqueCode;
            $('#uniqueCodeDisplay').html(`
                <i class="fas fa-key me-2"></i>
                <strong>${currentUniqueCode}</strong>
                <small class="ms-2 text-muted">(Click copy button to copy)</small>
            `);
            $('#uniqueCodeDisplay').addClass('active');
            $('#copyCode').prop('disabled', false);
            showMessage('Unique code generated successfully!', 'success');
        }).fail(function() {
            showMessage('Error generating code. Please try again.', 'danger');
        });
    });
    
    // Copy code to clipboard
    $('#copyCode').click(function() {
        if (currentUniqueCode) {
            navigator.clipboard.writeText(currentUniqueCode).then(() => {
                const originalHtml = $(this).html();
                $(this).html('<i class="fas fa-check"></i>');
                showMessage('Code copied to clipboard!', 'success');
                
                setTimeout(() => {
                    $(this).html(originalHtml);
                }, 2000);
            }).catch(() => {
                showMessage('Failed to copy code', 'danger');
            });
        }
    });
    
    // Form submission
    $('#participantForm').submit(function(e) {
        e.preventDefault();
        
        if (!currentUniqueCode) {
            showMessage('Please generate a unique code first!', 'warning');
            return;
        }
        
        const formData = {
            participant1: $('#participant1').val().trim(),
            participant2: $('#participant2').val().trim(),
            phone1: $('#phone1').val().trim(),
            phone2: $('#phone2').val().trim(),
            teamName: $('#teamName').val().trim()
        };
        
        // Validation
        if (!formData.participant1 || !formData.participant2 || 
            !formData.phone1 || !formData.phone2 || !formData.teamName) {
            showMessage('Please fill in all required fields!', 'danger');
            return;
        }
        
        if (!isValidPhone(formData.phone1) || !isValidPhone(formData.phone2)) {
            showMessage('Please enter valid phone numbers!', 'danger');
            return;
        }
        
        // Disable button and show loading
        const submitBtn = $('#addParticipant');
        submitBtn.prop('disabled', true);
        submitBtn.html('<i class="fas fa-spinner fa-spin me-2"></i>Adding Team...');
        
        // Send to server
        $.ajax({
            url: '/api/participants',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(response) {
                showMessage(`✅ ${response.message} - Code: ${response.uniqueCode}`, 'success');
                $('#participantForm')[0].reset();
                currentUniqueCode = '';
                $('#uniqueCodeDisplay').html('<i class="fas fa-info-circle me-2"></i>Click "Generate" to create a unique code');
                $('#uniqueCodeDisplay').removeClass('active');
                $('#copyCode').prop('disabled', true);
                
                // Refresh participants list
                loadParticipants();
            },
            error: function(xhr) {
                const error = xhr.responseJSON ? xhr.responseJSON.error : 'Unknown error occurred';
                showMessage(`❌ Error: ${error}`, 'danger');
            },
            complete: function() {
                submitBtn.prop('disabled', false);
                submitBtn.html('<i class="fas fa-plus-circle me-2"></i>Add Team to Database');
            }
        });
    });
    
    // Load participants
    function loadParticipants() {
        $.get('/api/participants', function(participants) {
            const tbody = $('#participantsList');
            
            if (participants.length === 0) {
                tbody.html(`
                    <tr>
                        <td colspan="7" class="text-center text-muted py-4">
                            <i class="fas fa-users me-2"></i>No teams registered yet
                        </td>
                    </tr>
                `);
                $('#participantCount').text('0');
                return;
            }
            
            let html = '';
            participants.forEach(participant => {
                const registeredDate = participant.created_at ? 
                    new Date(participant.created_at._seconds * 1000).toLocaleDateString() : 'N/A';
                    
                html += `
                    <tr>
                        <td><strong>${escapeHtml(participant.teamName)}</strong></td>
                        <td>${escapeHtml(participant.participant1)}</td>
                        <td>${escapeHtml(participant.participant2)}</td>
                        <td>
                            <small class="text-muted">P1:</small> ${escapeHtml(participant.phone1)}<br>
                            <small class="text-muted">P2:</small> ${escapeHtml(participant.phone2)}
                        </td>
                        <td>
                            <span class="badge bg-dark">${escapeHtml(participant.uniqueCode)}</span>
                        </td>
                        <td><small class="text-muted">${registeredDate}</small></td>
                        <td>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteParticipant('${participant.id}')">
                                <i class="fas fa-trash me-1"></i>Delete
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            tbody.html(html);
            $('#participantCount').text(participants.length);
        }).fail(function() {
            $('#participantsList').html(`
                <tr>
                    <td colspan="7" class="text-center text-danger py-4">
                        <i class="fas fa-exclamation-triangle me-2"></i>Error loading participants
                    </td>
                </tr>
            `);
        });
    }
    
    // Delete participant
    window.deleteParticipant = function(participantId) {
        if (confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
            $.ajax({
                url: `/api/participants/${participantId}`,
                method: 'DELETE',
                success: function(response) {
                    showMessage('✅ Team deleted successfully!', 'success');
                    loadParticipants();
                },
                error: function(xhr) {
                    const error = xhr.responseJSON ? xhr.responseJSON.error : 'Unknown error occurred';
                    showMessage(`❌ Error deleting team: ${error}`, 'danger');
                }
            });
        }
    };
    
    // Utility functions
    function showMessage(message, type) {
        const messageDiv = $('#message');
        const alertClass = `alert-${type}`;
        
        messageDiv.html(`
            <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `);
        
        // Auto-dismiss success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                messageDiv.find('.alert').alert('close');
            }, 5000);
        }
    }
    
    function isValidPhone(phone) {
        const phoneRegex = /^[\+]?[0-9]{10,15}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    }
    
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    // Initial load
    loadParticipants();
    
    // Refresh participants every 30 seconds
    setInterval(loadParticipants, 30000);
});