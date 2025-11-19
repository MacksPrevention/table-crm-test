export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Preflight
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const { path, token } = req.query;

    if (!path || !token) {
        return res.status(400).json({ error: "Missing path or token" });
    }

    const apiUrl = `https://app.tablecrm.com/api/v1/${path}?token=${token}`;

    const apiRes = await fetch(apiUrl, {
        method: req.method,
        headers: { "Content-Type": "application/json" },
        body: req.method !== "GET" ? JSON.stringify(req.body) : undefined
    });

    const text = await apiRes.text();
    try {
        const json = JSON.parse(text);
        return res.status(apiRes.status).json(json);
    } catch {
        return res.status(apiRes.status).send(text);
    }
}
