
const { Client } = require('@notionhq/client');
require('dotenv').config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID || '714b76dc6cde47f696309c5f70d189e9';

async function listKeys() {
    try {
        const response = await notion.databases.query({
            database_id: DATABASE_ID,
            page_size: 1
        });
        if (response.results.length > 0) {
            console.log('KEYS:', Object.keys(response.results[0].properties).join(', '));
        } else {
            console.log('No data.');
        }
    } catch (e) { console.error(e.message); }
}
listKeys();
