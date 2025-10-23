$(document).ready(function() {
    let currentUniqueCode = '';
    
    // Generate unique code
    $('#generateCode').click(function() {
        $.get('/api/generate-code', function(response) {
            currentUniqueCode = response.uniqueCode;
            $('#uniqueCodeDisplay').html(`
                <i class="fas fa-key me-2"></i>
                <strong>${currentUniqueCode}</strong>
                <small class="ms-2">READY TO USE</small>
            `);
            $('#uniqueCodeDisplay').addClass('active');
            $('#copyCode').prop('disabled', false);
            showMessage('✅ Unique code generated successfully!', 'success');
        }).fail(function() {
            showMessage('❌ Error generating code. Please try again.', 'danger');
        });
    });
    
    // Copy code to clipboard
    $('#copyCode').click(function() {
        if (currentUniqueCode) {
            navigator.clipboard.writeText(currentUniqueCode).then(() => {
                const originalHtml = $(this).html();
                $(this).html('<i class="fas fa-check"></i>');
                showMessage('📋 Code copied to clipboard!', 'success');
                
                setTimeout(() => {
                    $(this).html(originalHtml);
                }, 2000);
            }).catch(() => {
                showMessage('❌ Failed to copy code', 'danger');
            });
        }
    });
    
    // Form submission
    $('#participantForm').submit(function(e) {
        e.preventDefault();
        
        if (!currentUniqueCode) {
            showMessage('⚠️ Please generate a unique code first!', 'warning');
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
            showMessage('❌ Please fill in all required fields!', 'danger');
            return;
        }
        
        if (!isValidPhone(formData.phone1) || !isValidPhone(formData.phone2)) {
            showMessage('❌ Please enter valid phone numbers!', 'danger');
            return;
        }
        
        // Disable button and show loading
        const submitBtn = $('#addParticipant');
        submitBtn.prop('disabled', true);
        submitBtn.html('<i class="fas fa-spinner fa-spin me-2"></i>REGISTERING...');
        
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
                $('#uniqueCodeDisplay').html('<i class="fas fa-info-circle me-2"></i>CLICK GENERATE TO CREATE UNIQUE CODE');
                $('#uniqueCodeDisplay').removeClass('active');
                $('#copyCode').prop('disabled', true);
                
                // Refresh participants list
                loadParticipants();
            },
            error: function(xhr) {
                const error = xhr.responseJSON ? xhr.responseJSON.error : 'Unknown error occurred';
                showMessage(`❌ Registration failed: ${error}`, 'danger');
            },
            complete: function() {
                submitBtn.prop('disabled', false);
                submitBtn.html('<i class="fas fa-plus-circle me-2"></i>REGISTER TEAM');
            }
        });
    });
    
    // Load participants and update stats
    function loadParticipants() {
        $.get('/api/participants', function(participants) {
            updateStats(participants);
            renderParticipantsTable(participants);
        }).fail(function() {
            $('#participantsList').html(`
                <tr>
                    <td colspan="6" class="text-center text-danger py-4">
                        <i class="fas fa-exclamation-triangle me-2"></i>Cannot connect to database
                    </td>
                </tr>
            `);
        });
    }
    
    function updateStats(participants) {
        const totalTeams = participants.length;
        const leaderboardTeams = participants.filter(p => p.in_leaderboard).length;
        const pendingTeams = totalTeams - leaderboardTeams;
        
        $('#totalTeams').text(totalTeams);
        $('#leaderboardTeams').text(leaderboardTeams);
        $('#pendingTeams').text(pendingTeams);
        $('#participantCount').text(totalTeams);
    }
    
    function renderParticipantsTable(participants) {
        const tbody = $('#participantsList');
        
        if (participants.length === 0) {
            tbody.html(`
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="fas fa-users me-2"></i>No teams registered yet
                    </td>
                </tr>
            `);
            return;
        }
        
        let html = '';
        participants.forEach(participant => {
            const inLeaderboard = participant.in_leaderboard;
            const status = inLeaderboard ? (participant.leaderboard_status || 'offline') : 'registered';
            const points = inLeaderboard ? (participant.leaderboard_points || 0) : 0;
            const wins = inLeaderboard ? (participant.leaderboard_wins || 0) : 0;
            const games = inLeaderboard ? (participant.games_played || 0) : 0;
            
            const statusText = inLeaderboard ? 
                (status === 'online' ? 'ONLINE' : 'OFFLINE') : 
                'REGISTERED';
                
            const statusClass = inLeaderboard ? 
                (status === 'online' ? 'status-online' : 'status-offline') : 
                'status-registered';
            
            html += `
                <tr>
                    <td>
                        <strong>${escapeHtml(participant.teamName)}</strong>
                    </td>
                    <td>
                        <small>${escapeHtml(participant.participant1)}</small><br>
                        <small>${escapeHtml(participant.participant2)}</small>
                    </td>
                    <td>
                        <code>${escapeHtml(participant.uniqueCode)}</code>
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </td>
                    <td>
                        ${inLeaderboard ? `
                            <div class="text-center">
                                <div class="text-success">${points} PTS</div>
                                <small class="text-muted">${wins} W • ${games} G</small>
                            </div>
                        ` : '<span class="text-muted">NOT IN LEADERBOARD</span>'}
                    </td>
                    <td>
                        <div class="btn-group">
                            ${!inLeaderboard ? `
                                <button class="btn btn-sm btn-success" onclick="moveToLeaderboard('${participant.id}')">
                                    <i class="fas fa-play me-1"></i>START
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteParticipant('${participant.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tbody.html(html);
    }
    
    // Move to leaderboard
    window.moveToLeaderboard = function(participantId) {
        if (confirm('Move this team to leaderboard?')) {
            $.ajax({
                url: `/api/move-to-leaderboard/${participantId}`,
                method: 'POST',
                success: function(response) {
                    showMessage(`✅ ${response.message}`, 'success');
                    loadParticipants();
                },
                error: function(xhr) {
                    const error = xhr.responseJSON ? xhr.responseJSON.error : 'Unknown error occurred';
                    showMessage(`❌ Failed to move to leaderboard: ${error}`, 'danger');
                }
            });
        }
    };
    
    // Delete participant
    window.deleteParticipant = function(participantId) {
        if (confirm('Delete this team? This action cannot be undone.')) {
            $.ajax({
                url: `/api/participants/${participantId}`,
                method: 'DELETE',
                success: function(response) {
                    showMessage('✅ Team deleted successfully', 'success');
                    loadParticipants();
                },
                error: function(xhr) {
                    const error = xhr.responseJSON ? xhr.responseJSON.error : 'Unknown error occurred';
                    showMessage(`❌ Deletion failed: ${error}`, 'danger');
                }
            });
        }
    };
    
    // Utility functions
    function showMessage(message, type) {
        const messageDiv = $('#message');
        const alertClass = `alert-${type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'danger'}`;
        
        messageDiv.html(`
            <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                <strong>${message}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `);
        
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
    
    // Auto-refresh every 10 seconds
    setInterval(loadParticipants, 10000);
});