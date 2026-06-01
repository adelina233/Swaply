const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendPushNotification = onCall({ region: "us-central1" }, async (request) => {
    const data = request.data;
    
    // Avem nevoie de pushToken-ul partenerului (salvat în baza de date)
    const { pushToken, title, body } = data;

    if (!pushToken || !title || !body) {
        throw new HttpsError("invalid-argument", "Lipsesc datele pentru notificare.");
    }

    const message = {
        notification: { title, body },
        token: pushToken,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log("Notificare trimisă cu succes:", response);
        return { success: true };
    } catch (error) {
        console.error("Eroare la trimiterea notificării:", error);
        throw new HttpsError("internal", error.message);
    }
});