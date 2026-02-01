
const { Client } = require('@notionhq/client');
require('dotenv').config({ path: '.env.local' });

// Use keys from .env.local
const notion = new Client({
    auth: process.env.NOTION_API_KEY
});

// Use NOTION_DATABASE_ID from env OR the one found in app/api/notion.ts
const DATABASE_ID = process.env.NOTION_DATABASE_ID || '714b76dc6cde47f696309c5f70d189e9';

async function debugDailyIncome() {
    console.log('Querying Database ID:', DATABASE_ID);

    try {
        const response = await notion.databases.query({
            database_id: DATABASE_ID,
            page_size: 1
        });

        if (response.results.length === 0) {
            console.log('No data found in database.');
            return;
        }

        const firstPage = response.results[0];
        console.log('Found ID:', firstPage.id);
        console.log('Properties:', JSON.stringify(Object.keys(firstPage.properties), null, 2));

        // Also print the structure of one property to verify type (number vs rich_text etc)
        const propName = Object.keys(firstPage.properties)[0];
        console.log(`Example Property (${propName}):`, JSON.stringify(firstPage.properties[propName], null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugDailyIncome();
