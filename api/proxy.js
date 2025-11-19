export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const { path, token } = req.query;

    if (!path || !token) {
        return res.status(400).json({ error: "Missing path or token" });
    }

    const url = `https://app.tablecrm.com/api/v1/${path}?token=${token}`;

    try {
        const response = await fetch(url, {
            method: req.method,
            headers: {
                "Content-Type": req.headers["content-type"] || "application/json",
            },
            body: req.method !== "GET" ? req.body : undefined,
        });

        const text = await response.text();

        // If it's JSON — parse
        try {
            const json = JSON.parse(text);
            return res.status(response.status).json(json);
        } catch {
            // Not JSON — return as text
            return res.status(response.status).send(text);
        }
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
