require('dotenv').config();
const mongoose = require('mongoose');

const addStatusField = async () => {
  try {
    console.log('╔════════════════════════════════════════╗');
    console.log('║  📦 Add Status Field Migration         ║');
    console.log('║  Adding missing "status" field         ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    console.log('🔄 Starting migration...');
    console.log('📡 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });

    console.log('✅ Connected to MongoDB');
    console.log('🗄️  Database:', mongoose.connection.name);

    const db = mongoose.connection.db;
    
    // Find all users
    const allUsers = await db.collection('users').find({}).toArray();
    console.log(`\n📊 Total users in database: ${allUsers.length}`);

    // Check which users are missing status field
    const usersWithoutStatus = await db.collection('users').find({ 
      status: { $exists: false } 
    }).toArray();
    
    console.log(`🔍 Users without status field: ${usersWithoutStatus.length}`);

    if (usersWithoutStatus.length > 0) {
      console.log('\n📝 Sample users to be updated:');
      usersWithoutStatus.slice(0, 5).forEach(user => {
        console.log(`   - ${user.name} (${user.email}) - role: ${user.role}`);
      });

      // ⭐ Add status field to all users without it
      // Set to 'approved' for existing users (they're already in the system)
      console.log('\n🔄 Adding "status" field to users...');
      const result = await db.collection('users').updateMany(
        { status: { $exists: false } },
        { 
          $set: { 
            status: 'approved',  // ⭐ Existing users are approved
            active: true         // ⭐ Also ensure active field exists
          } 
        }
      );

      console.log(`✅ Updated ${result.modifiedCount} users with status field`);
    } else {
      console.log('✅ All users already have status field');
    }

    // Check for users without active field
    const usersWithoutActive = await db.collection('users').find({ 
      active: { $exists: false } 
    }).toArray();
    
    if (usersWithoutActive.length > 0) {
      console.log(`\n🔍 Found ${usersWithoutActive.length} users without active field`);
      const activeResult = await db.collection('users').updateMany(
        { active: { $exists: false } },
        { $set: { active: true } }
      );
      console.log(`✅ Added active field to ${activeResult.modifiedCount} users`);
    }

    // Verify all required fields exist
    console.log('\n📊 Verifying all users have required fields...');
    
    const verification = await db.collection('users').aggregate([
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          hasStatus: { $ifNull: ['$status', false] },
          hasActive: { $ifNull: ['$active', false] },
          status: 1,
          active: 1
        }
      }
    ]).toArray();

    const missingFields = verification.filter(u => !u.hasStatus || !u.hasActive);
    
    if (missingFields.length === 0) {
      console.log('✅ All users have required fields (status, active)');
    } else {
      console.log(`⚠️  ${missingFields.length} users still missing fields:`);
      missingFields.forEach(u => {
        console.log(`   - ${u.name}: status=${u.hasStatus}, active=${u.hasActive}`);
      });
    }

    // Show status distribution
    console.log('\n📊 Final status distribution:');
    const statusCounts = await db.collection('users').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]).toArray();
    
    console.table(statusCounts);

    // Show active distribution
    console.log('\n📊 Active field distribution:');
    const activeCounts = await db.collection('users').aggregate([
      {
        $group: {
          _id: '$active',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    console.table(activeCounts);

    console.log('\n✅ Migration complete!');
    console.log('📝 All existing users now have status="approved"');
    console.log('📝 New users will be created with status="pending"\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

addStatusField();