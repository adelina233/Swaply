import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();


function multipleLinearRegression(X: number[][], Y: number[]): (x: number[]) => number {
    const n = X.length;
    const cols = X[0].length;

    // Adaugă coloana de 1 pentru intercept
    const Xb = X.map(row => [1, ...row]);
    const k = cols + 1;

    // Calculează X^T * X
    const XtX: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
    for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
            for (let r = 0; r < n; r++) {
                XtX[i][j] += Xb[r][i] * Xb[r][j];
            }
        }
    }

    // Calculează X^T * Y
    const XtY: number[] = Array(k).fill(0);
    for (let i = 0; i < k; i++) {
        for (let r = 0; r < n; r++) {
            XtY[i] += Xb[r][i] * Y[r];
        }
    }

    
    const aug: number[][] = XtX.map((row, i) => [...row, XtY[i]]);
    for (let col = 0; col < k; col++) {
        let maxRow = col;
        for (let row = col + 1; row < k; row++) {
            if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
        }
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
        for (let row = col + 1; row < k; row++) {
            const factor = aug[row][col] / aug[col][col];
            for (let j = col; j <= k; j++) {
                aug[row][j] -= factor * aug[col][j];
            }
        }
    }
    const beta: number[] = Array(k).fill(0);
    for (let i = k - 1; i >= 0; i--) {
        beta[i] = aug[i][k];
        for (let j = i + 1; j < k; j++) {
            beta[i] -= aug[i][j] * beta[j];
        }
        beta[i] /= aug[i][i];
    }

    return (x: number[]) => {
        let result = beta[0];
        for (let i = 0; i < x.length; i++) {
            result += beta[i + 1] * x[i];
        }
        return result;
    };
}

export const suggestGuarantee = onRequest({ cors: true }, async (req, res) => {
    try {
        const { size, rooms, isCapitalCity } = req.body;

        if (!size || !rooms) {
            res.status(400).send({
                error: "Date incomplete. Sunt necesare 'size' și 'rooms'."
            });
            return;
        }

        const receiptsSnapshot = await db
            .collection("receipt-details")
            .where("status", "==", "secured")
            .limit(100)
            .get();

        
        if (receiptsSnapshot.empty || receiptsSnapshot.size < 5) {
            const basePrice = Math.round(Number(size) * 8 + (Number(rooms) * 60));
            const fallbackSuggestion = Math.round(basePrice / 50) * 50;

            res.status(200).send({
                suggestedGuarantee: fallbackSuggestion < 200 ? 200 : fallbackSuggestion,
                isFallback: true
            });
            return;
        }

        const X: number[][] = [];
        const Yflat: number[] = [];

        receiptsSnapshot.forEach(doc => {
            const data = doc.data();
            X.push([
                Number(data.apartmentSize || 50),
                Number(data.apartmentRooms || 2),
                data.isCapital ? 1 : 0
            ]);
            Yflat.push(Number(data.amount || 500));
        });

        const predict = multipleLinearRegression(X, Yflat);

        const currentIsCapital = isCapitalCity ? 1 : 0;
        const prediction = predict([Number(size), Number(rooms), currentIsCapital]);

        let finalSuggestion = Math.round(prediction / 50) * 50;
        if (finalSuggestion < 200) finalSuggestion = 200;

        res.status(200).send({
            suggestedGuarantee: finalSuggestion,
            isFallback: false
        });

    } catch (error) {
        console.error("ML Prediction Error:", error);
        res.status(500).send({
            error: "A apărut o eroare în cadrul algoritmului predictiv ML."
        });
    }
});