const bcrypt = require('bcryptjs');

async function testPassword() {
    const testPassword = 'Admin123!';
    
    // Generate a new hash
    const newHash = await bcrypt.hash(testPassword, 10);
    console.log('New hash for password:', newHash);
    
    // Test comparing with the new hash
    const match1 = await bcrypt.compare(testPassword, newHash);
    console.log('Password matches new hash:', match1);
    
    // Test with some known hashes (you can add actual hashes from your database here)
    const knownHashes = [
        '$2a$10$YourHashHere', // Replace with actual hash from database
    ];
    
    for (const hash of knownHashes) {
        try {
            const matches = await bcrypt.compare(testPassword, hash);
            console.log(`Password matches hash ${hash}:`, matches);
        } catch (error) {
            console.log(`Error comparing with hash ${hash}:`, error.message);
        }
    }
    
    // Test bcrypt rounds
    console.log('\nTesting different salt rounds:');
    for (const rounds of [8, 10, 12]) {
        const hash = await bcrypt.hash(testPassword, rounds);
        const matches = await bcrypt.compare(testPassword, hash);
        console.log(`Rounds: ${rounds}, Hash: ${hash.substring(0, 20)}..., Matches: ${matches}`);
    }
}

testPassword().catch(console.error);