// Offline queue module using IndexedDB
import { api } from './api.js';

const DB_NAME = 'stadsspel_offline';
const DB_VERSION = 1;
const STORE_NAME = 'submission_queue';

let db = null;

export function initOfflineQueue() {
    openDatabase();
    
    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Process queue if online
    if (navigator.onLine) {
        processQueue();
    }
}

function openDatabase() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
        console.error('Failed to open IndexedDB');
    };
    
    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('IndexedDB opened successfully');
    };
    
    request.onupgradeneeded = (event) => {
        db = event.target.result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            const objectStore = db.createObjectStore(STORE_NAME, { 
                keyPath: 'id', 
                autoIncrement: true 
            });
            objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            console.log('Created object store:', STORE_NAME);
        }
    };
}

export function queueSubmission(submissionData) {
    if (!db) {
        console.error('Database not ready');
        return;
    }
    
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    
    const queueItem = {
        ...submissionData,
        timestamp: Date.now(),
        status: 'pending',
    };
    
    const request = objectStore.add(queueItem);
    
    request.onsuccess = () => {
        console.log('Submission queued for later:', queueItem);
        updateQueueCount();
    };
    
    request.onerror = () => {
        console.error('Failed to queue submission');
    };
}

function handleOnline() {
    console.log('Back online, processing queue...');
    document.getElementById('offline-indicator').style.display = 'none';
    processQueue();
}

function handleOffline() {
    console.log('Gone offline');
    document.getElementById('offline-indicator').style.display = 'block';
}

async function processQueue() {
    if (!db) return;
    
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();
    
    request.onsuccess = async (event) => {
        const queueItems = event.target.result;
        
        if (queueItems.length === 0) {
            return;
        }
        
        console.log(`Processing ${queueItems.length} queued submissions...`);
        
        for (const item of queueItems) {
            try {
                await api.createSubmission(
                    item.areaId,
                    item.text,
                    item.score,
                    item.photoFiles || [],
                    item.videoFiles || []
                );
                
                // Remove from queue
                removeFromQueue(item.id);
                console.log('Successfully submitted queued item:', item.id);
                
            } catch (error) {
                console.error('Failed to submit queued item:', error);
                // Keep in queue, try again later
            }
        }
        
        updateQueueCount();
    };
}

function removeFromQueue(id) {
    if (!db) return;
    
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    objectStore.delete(id);
}

function updateQueueCount() {
    if (!db) return;
    
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const countRequest = objectStore.count();
    
    countRequest.onsuccess = () => {
        const count = countRequest.result;
        console.log(`Queue count: ${count}`);
        
        // Could display this count in the UI
        // For now just log it
    };
}
