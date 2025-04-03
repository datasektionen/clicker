// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- SSE Setup ---
let clients = []; // Array to hold connected client response objects for SSE

// Function to send event data to all connected clients
function broadcastUpdate(data) {
    const sseFormattedData = `data: ${JSON.stringify(data)}\n\n`; // SSE format
    console.log(`Broadcasting update: ${JSON.stringify(data)}`);
    clients.forEach(client => {
        try {
            client.res.write(sseFormattedData);
        } catch (error) {
            console.error(`Error sending SSE to client ${client.id}:`, error);
            // Optionally remove client if write fails, though 'close' event is better
        }
    });
}

// --- Helper Functions ---
const sendError = (res, statusCode, message, broadcast = false) => {
    console.error("API Error: ", message);
    // Avoid broadcasting generic errors unless specifically intended
    if (broadcast) {
         broadcastUpdate({ type: 'error', payload: { message } });
    }
    // Check if headers already sent (might happen if error occurs during SSE)
    if (!res.headersSent) {
        res.status(statusCode).json({ message });
    }
};


// --- API Routes ---

// SSE Endpoint
app.get('/api/events/stream', (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust CORS for SSE if needed
    res.flushHeaders(); // Flush the headers to establish the connection

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res: res, // Store the response object to write to
    };
    clients.push(newClient);
    console.log(`Client ${clientId} connected to SSE stream. Total clients: ${clients.length}`);

    // Send a simple connected message (optional)
    res.write(`data: ${JSON.stringify({ type: 'connected', payload: { clientId } })}\n\n`);

    // Handle client disconnection
    req.on('close', () => {
        console.log(`Client ${clientId} disconnected.`);
        clients = clients.filter(client => client.id !== clientId);
         console.log(`Total clients remaining: ${clients.length}`);
    });

    // Keep connection open, sending keep-alive comments periodically (optional, helps proxies)
    const keepAliveInterval = setInterval(() => {
        res.write(': keep-alive\n\n');
    }, 20000); // Every 20 seconds

    req.on('close', () => {
        clearInterval(keepAliveInterval);
    });
});


// GET /api/events - Get all events with their counters (No change needed here for SSE logic)
app.get('/api/events', async (req, res) => {
    const query = `
        SELECT
            e.id,
            e.name,
            e.created_at,
            COALESCE(
                (SELECT json_agg(
                    json_build_object(
                        'id', c.id,
                        'event_id', c.event_id, -- Include event_id in counter data
                        'name', c.name,
                        'count', c.count,
                        'created_at', c.created_at
                    ) ORDER BY c.created_at ASC
                )
                FROM counters c WHERE c.event_id = e.id),
                '[]'::json
            ) AS counters
        FROM events e
        ORDER BY e.created_at DESC;
    `;
    try {
        const { rows } = await db.query(query);
        const events = rows.map(event => ({
            ...event,
            counters: event.counters || []
        }));
        res.json(events);
    } catch (err) {
        sendError(res, 500, `Failed to retrieve events: ${err.message}`);
    }
});

// POST /api/events - Create a new event (with a default counter)
app.post('/api/events', async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return sendError(res, 400, 'Event name is required and must be a non-empty string.');
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const eventQuery = 'INSERT INTO events (name) VALUES ($1) RETURNING *';
        const eventResult = await client.query(eventQuery, [name.trim()]);
        const newEvent = eventResult.rows[0];

        const counterQuery = 'INSERT INTO counters (event_id, name, count) VALUES ($1, $2, $3) RETURNING *';
        const counterResult = await client.query(counterQuery, [newEvent.id, 'Main Entrance', 0]);
        const defaultCounter = counterResult.rows[0];

        await client.query('COMMIT');

        // Prepare data for broadcast and response
        const eventWithCounter = {
             ...newEvent,
             counters: [defaultCounter] // Send with the counter included
        };

        // Broadcast the change AFTER successful commit
        broadcastUpdate({ type: 'event_added', payload: eventWithCounter });

        res.status(201).json(eventWithCounter); // Respond to the original requester

    } catch (err) {
        await client.query('ROLLBACK');
        sendError(res, 500, `Failed to create event: ${err.message}`);
    } finally {
        client.release();
    }
});

// DELETE /api/events/:eventId - Delete an event
app.delete('/api/events/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const parsedEventId = parseInt(eventId);
    if (!Number.isInteger(parsedEventId)) {
        return sendError(res, 400, 'Invalid Event ID.');
    }

    try {
        // We need the ID to broadcast it
        const query = 'DELETE FROM events WHERE id = $1 RETURNING id';
        const result = await db.query(query, [parsedEventId]);

        if (result.rowCount === 0) {
            return sendError(res, 404, 'Event not found.');
        }

        // Broadcast the deletion AFTER successful delete
        broadcastUpdate({ type: 'event_removed', payload: { eventId: parsedEventId } });

        res.status(204).send(); // No Content

    } catch (err) {
        sendError(res, 500, `Failed to delete event: ${err.message}`);
    }
});

// POST /api/events/:eventId/counters - Add a counter to an event
app.post('/api/events/:eventId/counters', async (req, res) => {
    const { eventId } = req.params;
    const { name } = req.body;
    const parsedEventId = parseInt(eventId);

    if (!Number.isInteger(parsedEventId)) {
        return sendError(res, 400, 'Invalid Event ID.');
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return sendError(res, 400, 'Counter name is required.');
    }

    try {
        const eventCheck = await db.query('SELECT id FROM events WHERE id = $1', [parsedEventId]);
        if (eventCheck.rowCount === 0) {
            return sendError(res, 404, 'Event not found.');
        }

        const query = 'INSERT INTO counters (event_id, name, count) VALUES ($1, $2, $3) RETURNING *';
        const { rows } = await db.query(query, [parsedEventId, name.trim(), 0]);
        const newCounter = rows[0];

        // Broadcast the change AFTER successful insert
        broadcastUpdate({ type: 'counter_added', payload: newCounter }); // Send the full new counter object

        res.status(201).json(newCounter); // Respond to original requester

    } catch (err) {
        sendError(res, 500, `Failed to add counter: ${err.message}`);
    }
});

// DELETE /api/events/:eventId/counters/:counterId - Delete a specific counter
app.delete('/api/events/:eventId/counters/:counterId', async (req, res) => {
    const { eventId, counterId } = req.params;
    const parsedEventId = parseInt(eventId);
    const parsedCounterId = parseInt(counterId);

    if (!Number.isInteger(parsedEventId) || !Number.isInteger(parsedCounterId)) {
        return sendError(res, 400, 'Invalid Event or Counter ID.');
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const countCheckQuery = 'SELECT COUNT(*) FROM counters WHERE event_id = $1';
        const countResult = await client.query(countCheckQuery, [parsedEventId]);
        const counterCount = parseInt(countResult.rows[0].count, 10);

        if (counterCount <= 1) {
             await client.query('ROLLBACK');
             return sendError(res, 400, 'Cannot delete the last counter.');
        }

        const deleteQuery = 'DELETE FROM counters WHERE id = $1 AND event_id = $2 RETURNING id';
        const deleteResult = await client.query(deleteQuery, [parsedCounterId, parsedEventId]);

        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return sendError(res, 404, 'Counter not found or does not belong to the event.');
        }

        await client.query('COMMIT');

        // Broadcast the change AFTER successful delete
        broadcastUpdate({ type: 'counter_removed', payload: { eventId: parsedEventId, counterId: parsedCounterId } });

        res.status(204).send(); // Success, No Content

    } catch (err) {
         await client.query('ROLLBACK');
         sendError(res, 500, `Failed to delete counter: ${err.message}`);
    } finally {
        client.release();
    }
});

// PATCH /api/events/:eventId/counters/:counterId - Update a counter's count
app.patch('/api/events/:eventId/counters/:counterId', async (req, res) => {
    const { eventId, counterId } = req.params;
    const { change } = req.body;
    const parsedEventId = parseInt(eventId);
    const parsedCounterId = parseInt(counterId);


    if (!Number.isInteger(parsedEventId) || !Number.isInteger(parsedCounterId)) {
        return sendError(res, 400, 'Invalid Event or Counter ID.');
    }
    if (typeof change !== 'number' || ![-1, 1].includes(change)) {
        return sendError(res, 400, 'Invalid change value. Must be 1 or -1.');
    }

    try {
        const query = `
            UPDATE counters
            SET count = GREATEST(0, count + $1)
            WHERE id = $2 AND event_id = $3
            RETURNING *; -- Return the updated counter row
        `;
        const { rows } = await db.query(query, [change, parsedCounterId, parsedEventId]);

        if (rows.length === 0) {
            return sendError(res, 404, 'Counter not found or does not belong to the event.');
        }
        const updatedCounter = rows[0];

        // Broadcast the change AFTER successful update
        broadcastUpdate({ type: 'counter_updated', payload: updatedCounter }); // Send the full updated counter object

        res.json(updatedCounter); // Respond to original requester

    } catch (err) {
        sendError(res, 500, `Failed to update counter count: ${err.message}`);
    }
});


// Basic Health Check
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', clients: clients.length });
});


// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack);
    // Check if it's an SSE request that failed mid-stream
    if (res.headersSent && req.path === '/api/events/stream') {
        console.error("Error occurred after SSE headers sent, client will likely disconnect.");
        // Cannot send JSON error, connection might be broken or headers already text/event-stream
        res.end(); // Attempt to close the connection gracefully
    } else if (!res.headersSent) {
        // Standard JSON error for regular API requests
         sendError(res, 500, 'Something broke on the server!');
    } else {
        // Headers sent, but not SSE? Log and attempt end.
        console.error("Error occurred after headers sent on non-SSE request:", req.path);
        res.end();
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
    console.log(`SSE stream available at http://localhost:${PORT}/api/events/stream`);
});