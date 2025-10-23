$(document).ready(function() {
    let allData = { participants: [], leaderboard: [] };
    let distributionChart = null;

    // Load all combined data from server
    function loadAllData() {
        $.get('/api/all-data')
            .done(function(response) {
                // Ensure response shape
                allData.participants = Array.isArray(response.participants) ? response.participants : [];
                allData.leaderboard = Array.isArray(response.leaderboard) ? response.leaderboard : [];
                renderAllTeams();
                renderLeaderboard();
                updateAnalytics();
            })
            .fail(function() {
                showMessage('❌ Failed to load team data', 'danger');
                // render empty states
                allData = { participants: [], leaderboard: [] };
                renderAllTeams();
                renderLeaderboard();
                updateAnalytics();
            });
    }

    // Render 'All Teams' by combining participants and leaderboard
    function renderAllTeams() {
        const tbody = $('#allTeamsData');
        const allTeams = [...allData.participants, ...allData.leaderboard];

        $('#totalTeamsCount').text(allTeams.length);

        if (allTeams.length === 0) {
            tbody.html(`
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="fas fa-users me-2"></i>No teams found in system
                    </td>
                </tr>
            `);
            return;
        }

        let html = '';
        allTeams.forEach(team => {
            const isLeaderboard = team.collection === 'leaderboard' || !!team.name;
            const status = isLeaderboard ? (team.status || 'offline') : (team.status || 'registered');
            const wins = team.wins || team.leaderboard_wins || 0;
            const games = team.gamesPlayed || team.games_played || 0;
            const points = team.totalPoints || team.leaderboard_points || 0;

            const statusClass = status === 'registered' ? 'status-registered' :
                                status === 'online' ? 'status-online' : 'status-offline';

            const statusText = status === 'registered' ? 'REGISTERED' :
                                status === 'online' ? 'ONLINE' : 'OFFLINE';

            html += `
                <tr>
                    <td>
                        <strong>${escapeHtml(team.teamName || team.name || '')}</strong>
                    </td>
                    <td>
                        <small>${escapeHtml(team.participant1 || '')}</small><br>
                        <small>${escapeHtml(team.participant2 || '')}</small>
                    </td>
                    <td>
                        <small>${escapeHtml(team.phone1 || '')}</small><br>
                        <small>${escapeHtml(team.phone2 || '')}</small>
                    </td>
                    <td>
                        <code>${escapeHtml(team.uniqueCode || team.unique_code || '')}</code>
                    </td>
                    <td>
                        <span class="badge ${isLeaderboard ? 'bg-success' : 'bg-secondary'}">
                            ${isLeaderboard ? 'LEADERBOARD' : 'REGISTRATION'}
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </td>
                    <td>
                        ${isLeaderboard ? `
                            <div class="d-flex gap-2 align-items-center">
                                <select id="status-select-${team.id}" class="form-select form-select-sm" style="width:120px;">
                                    <option value="online" ${status === 'online' ? 'selected' : ''}>ONLINE</option>
                                    <option value="offline" ${status !== 'online' ? 'selected' : ''}>OFFLINE</option>
                                </select>
                                <button class="btn btn-sm btn-primary" onclick="updateStatusFromSelect('${team.id}')">Update</button>
                            </div>
                        ` : `
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-success" onclick="moveToLeaderboardFromView('${team.id}')">
                                    <i class="fas fa-play me-1"></i>START
                                </button>
                            </div>
                        `}
                    </td>
                </tr>
            `;
        });

        tbody.html(html);
    }

    // Render leaderboard table
    function renderLeaderboard() {
        const tbody = $('#leaderboardData');
        const leaderboard = Array.isArray(allData.leaderboard) ? allData.leaderboard.slice() : [];

        $('#leaderboardCount').text(leaderboard.length);

        if (leaderboard.length === 0) {
            tbody.html(`
                <tr>
                    <td colspan="4" class="text-center text-muted py-4">
                        <i class="fas fa-trophy me-2"></i>No teams in leaderboard yet
                    </td>
                </tr>
            `);
            return;
        }

        let html = '';
        leaderboard.forEach((team, index) => {
            const rank = index + 1;
            const rankClass = rank === 1 ? 'text-warning' : rank === 2 ? 'text-secondary' : rank === 3 ? 'text-bronze' : 'text-muted';
            const status = team.status || 'offline';
            const p1 = escapeHtml(team.participant1 || team.participant_1 || '');
            const p2 = escapeHtml(team.participant2 || team.participant_2 || '');
            const phone1 = escapeHtml(team.phone1 || '');
            const phone2 = escapeHtml(team.phone2 || '');
            const uniqueCode = escapeHtml(team.uniqueCode || team.unique_code || '');

            const pts = team.totalPoints || team.leaderboard_points || 0;
            const winsVal = team.wins || team.leaderboard_wins || 0;
            const gamesVal = team.gamesPlayed || team.games_played || 0;

            html += `
                <tr>
                    <td>
                        <span class="rank-number ${rankClass}">#${rank}</span>
                    </td>
                    <td>
                        <strong>${escapeHtml(team.name || team.teamName || '')}</strong>
                    </td>
                    <td>
                        <strong>${pts}</strong>
                    </td>
                    <td>
                        <strong>${winsVal}</strong>
                    </td>
                    <td>
                        <strong>${gamesVal}</strong>
                    </td>
                </tr>
            `;
        });

        tbody.html(html);
    }

    // Update analytics widgets and chart
    function updateAnalytics() {
        const totalTeams = (allData.participants || []).length + (allData.leaderboard || []).length;
        const activeTeams = (allData.leaderboard || []).length;
        const totalPoints = (allData.leaderboard || []).reduce((sum, team) => sum + (team.totalPoints || team.leaderboard_points || 0), 0);

        $('#totalTeamsStat').text(totalTeams);
        $('#activeTeamsStat').text(activeTeams);
        $('#pointsStat').text(totalPoints);

        updateDistributionChart();
    }

    function updateDistributionChart() {
        if (!allData || !Array.isArray(allData.participants) || !Array.isArray(allData.leaderboard)) return;

        const canvas = document.getElementById('distributionChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const registered = allData.participants.length;
        const inLeaderboard = allData.leaderboard.length;

        if (distributionChart) distributionChart.destroy();

        distributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Registered', 'In Leaderboard'],
                datasets: [{
                    data: [registered, inLeaderboard],
                    backgroundColor: ['rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)'],
                    borderColor: ['rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // Move to leaderboard from view page
    window.moveToLeaderboardFromView = function(participantId) {
        if (!participantId) return;
        if (confirm('Move this team to leaderboard?')) {
            $.post(`/api/move-to-leaderboard/${participantId}`)
                .done(function(response) {
                    showMessage(`✅ ${response.message}`, 'success');
                    loadAllData();
                })
                .fail(function(xhr) {
                    const error = xhr.responseJSON ? xhr.responseJSON.error : 'Unknown error occurred';
                    showMessage(`❌ Failed to move to leaderboard: ${error}`, 'danger');
                });
        }
    };

    // Toggle leaderboard entry status
    window.toggleLeaderboardStatus = function(leaderboardId, newStatus) {
        if (!leaderboardId) return;
        $.ajax({
            url: `/api/leaderboard/${leaderboardId}/status`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ status: newStatus })
        }).done(function(response) {
            showMessage(`✅ ${response.message}`, 'success');
            loadAllData();
        }).fail(function(xhr) {
            const error = xhr.responseJSON ? xhr.responseJSON.error : 'Unknown error occurred';
            showMessage(`❌ Failed to update status: ${error}`, 'danger');
        });
    };

    // Read select and update status (used by All Teams actions for leaderboard entries)
    window.updateStatusFromSelect = function(leaderboardId) {
        const select = document.getElementById(`status-select-${leaderboardId}`);
        if (!select) return;
        const newStatus = select.value;
        if (!leaderboardId || !newStatus) return;

        $.ajax({
            url: `/api/leaderboard/${leaderboardId}/status`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ status: newStatus })
        }).done(function(response) {
            showMessage(`✅ ${response.message}`, 'success');
            loadAllData();
        }).fail(function(xhr) {
            const error = xhr.responseJSON ? xhr.responseJSON.error : 'Unknown error occurred';
            showMessage(`❌ Failed to update status: ${error}`, 'danger');
        });
    };

    // Utility functions
    function showMessage(message, type) {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3" style="z-index: 9999;" role="alert">
                <strong>${message}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        $('body').append(alertHtml);
        setTimeout(() => { $('.alert').alert('close'); }, 5000);
    }

    function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        const str = String(unsafe);
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // PDF export: Team Name, Participants, Phone numbers
    function exportAllTeamsToPdf() {
        try {
            // Prepare rows from combined participants + leaderboard
            const rows = [];
            const combined = [...(allData.participants || []), ...(allData.leaderboard || [])];

            combined.forEach(team => {
                rows.push([
                    team.teamName || team.name || '',
                    team.participant1 || '',
                    team.participant2 || '',
                    team.phone1 || '',
                    team.phone2 || ''
                ]);
            });

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

            doc.setFontSize(14);
            doc.text('Laughing Legends Participants', 40, 40);

            // AutoTable columns
            doc.autoTable({
                startY: 70,
                head: [['Team Name', 'Participant 1', 'Participant 2', 'Phone 1', 'Phone 2']],
                body: rows,
                styles: { fontSize: 10 },
                headStyles: { fillColor: [41, 128, 185] }
            });

            const fileName = 'LaughingLegends_Participants.pdf';
            doc.save(fileName);
        } catch (err) {
            console.error('PDF export failed', err);
            showMessage('❌ PDF export failed', 'danger');
        }
    }

    // Bind PDF button (if present)
    $(document).on('click', '#downloadPdf', function() {
        exportAllTeamsToPdf();
    });

    // Initial load
    loadAllData();
    setInterval(loadAllData, 15000);
});