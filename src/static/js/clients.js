document.addEventListener("DOMContentLoaded", function () {
    const clientsButton = document.getElementById("clientsButton");
    const clientsModal = document.getElementById("clientsModal");
    const clientsList = document.getElementById("clientsList");
    const closeClients = document.getElementById("closeClients");

    clientsButton.addEventListener("click", async function () {
        clientsModal.classList.remove("hidden");
        await loadConnectedClients();
    });

    closeClients.addEventListener("click", function () {
        clientsModal.classList.add("hidden");
    });

    clientsModal.addEventListener("click", function (event) {
        if (event.target === clientsModal) {
            clientsModal.classList.add("hidden");
        }
    });

    document.addEventListener("keydown", function (event) {
        if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") {
            return;
        }
    
        const clientsModal = document.getElementById("clientsModal");
        const settingsModal = document.getElementById("settingsModal");
        const confirmationModal = document.getElementById("confirmationModal");
    
        if (settingsModal && !settingsModal.classList.contains("hidden")) return;
        if (confirmationModal && !confirmationModal.classList.contains("hidden")) return;
    
        if (event.key === "c") {
            event.preventDefault();
            if (clientsModal.classList.contains("hidden")) {
                clientsButton.click();
            } else {
                closeClients.click();
            }
        }
    });

    async function loadConnectedClients() {
        try {
            const response = await fetch("/api/clients");
            if (!response.ok) throw new Error("Failed to load clients");

            const data = await response.json();
            clientsList.innerHTML = "";

            if (data.clients.length === 0) {
                clientsList.innerHTML = "<p>No active clients.</p>";
                return;
            }

            data.clients.forEach(client => {
                const clientItem = document.createElement("div");
                clientItem.classList.add("client-item");
                clientItem.innerHTML = `
                    <span>${client.ip}</span>
                    <button class="disconnect-btn" data-ip="${client.ip}">Disconnect</button>
                `;
                clientsList.appendChild(clientItem);
            });

            document.querySelectorAll(".disconnect-btn").forEach(button => {
                button.addEventListener("click", function () {
                    const clientIp = this.getAttribute("data-ip");
                    disconnectClient(clientIp);
                });
            });

        } catch (error) {
            console.error("Error loading connected clients:", error);
            clientsList.innerHTML = "<p style='color: red;'>Error loading clients.</p>";
        }
    }

    async function disconnectClient(ip) {
        try {
            const response = await fetch("/api/disconnect_client", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ip }),
            });
    
            const result = await response.json();
            if (result.success) {
                await loadConnectedClients(); // Update list
            } else {
                console.error("Failed to disconnect client:", result.error);
            }
        } catch (error) {
            console.error("Error disconnecting client:", error);
        }
    }
});
