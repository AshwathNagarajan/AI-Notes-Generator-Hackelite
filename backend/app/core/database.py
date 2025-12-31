from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from app.core.config import settings
import logging
from typing import Any, Dict, Optional
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

# In-memory storage fallback when MongoDB is not available
class InMemoryDB:
    def __init__(self):
        self.collections: Dict[str, Dict[str, Any]] = {
            'users': {},
            'history': {},
            'image_history': {}
        }
    
    def get_collection(self, name: str):
        if name not in self.collections:
            self.collections[name] = {}
        return InMemoryCollection(self.collections[name])

class InMemoryCollection:
    def __init__(self, data: Dict[str, Any]):
        self.data = data
    
    async def insert_one(self, document: Dict):
        doc_id = str(uuid.uuid4())
        document['_id'] = doc_id
        self.data[doc_id] = document
        return type('Result', (), {'inserted_id': doc_id})()
    
    async def find_one(self, query: Dict):
        for doc in self.data.values():
            if self._matches_query(doc, query):
                return doc
        return None
    
    def find(self, query: Dict = None):
        """Returns a cursor-like object that supports chaining."""
        if query is None:
            query = {}
        return InMemoryCursor(self, query)
    
    def _matches_query(self, doc: Dict, query: Dict) -> bool:
        """Check if a document matches the query."""
        for key, value in query.items():
            if key not in doc:
                return False
            
            # Handle MongoDB operators like $gte, $lte, etc.
            if isinstance(value, dict):
                for op, op_value in value.items():
                    if op == "$gte":
                        if not (doc[key] >= op_value):
                            return False
                    elif op == "$lte":
                        if not (doc[key] <= op_value):
                            return False
                    elif op == "$gt":
                        if not (doc[key] > op_value):
                            return False
                    elif op == "$lt":
                        if not (doc[key] < op_value):
                            return False
                    elif op == "$eq":
                        if doc[key] != op_value:
                            return False
                    elif op == "$ne":
                        if doc[key] == op_value:
                            return False
            else:
                # Simple equality check
                if doc[key] != value:
                    return False
        return True
    
    async def update_one(self, query: Dict, update: Dict):
        for doc_id, doc in self.data.items():
            if self._matches_query(doc, query):
                if '$set' in update:
                    doc.update(update['$set'])
                else:
                    doc.update(update)
                return type('Result', (), {'modified_count': 1})()
        return type('Result', (), {'modified_count': 0})()
    
    async def delete_one(self, query: Dict):
        for doc_id, doc in list(self.data.items()):
            if self._matches_query(doc, query):
                del self.data[doc_id]
                return type('Result', (), {'deleted_count': 1})()
        return type('Result', (), {'deleted_count': 0})()

class InMemoryCursor:
    """Mimics MongoDB cursor interface for in-memory collections."""
    def __init__(self, collection: InMemoryCollection, query: Dict):
        self.collection = collection
        self.query = query
        self.sort_fields = []
        self.limit_count = None
        self.skip_count = 0
    
    def sort(self, key: str, direction: int = 1):
        """Add sort criteria (direction: 1 for ascending, -1 for descending)."""
        self.sort_fields.append((key, direction))
        return self
    
    def skip(self, count: int):
        """Skip results."""
        self.skip_count = count
        return self
    
    def limit(self, count: int):
        """Limit results."""
        self.limit_count = count
        return self
    
    async def to_list(self, length: Optional[int] = None):
        """Get results as a list."""
        results = []
        for doc in self.collection.data.values():
            if self.collection._matches_query(doc, self.query):
                results.append(doc)
        
        # Apply sorting
        for key, direction in reversed(self.sort_fields):
            results.sort(key=lambda x: x.get(key, ""), reverse=(direction == -1))
        
        # Apply skip
        if self.skip_count:
            results = results[self.skip_count:]
        
        # Apply limit
        if self.limit_count:
            results = results[:self.limit_count]
        elif length:
            results = results[:length]
        
        return results

class Database:
    client: AsyncIOMotorClient = None
    sync_client: MongoClient = None
    in_memory_db: Optional[InMemoryDB] = None

db = Database()

async def connect_to_mongo():
    """Create database connection."""
    try:
        # Add connection options for better stability
        connection_options = {
            'serverSelectionTimeoutMS': 5000,  # 5 seconds timeout
            'connectTimeoutMS': 10000,
            'retryWrites': True,
            'maxPoolSize': 10
        }
        
        db.client = AsyncIOMotorClient(settings.mongodb_url, **connection_options)
        db.sync_client = MongoClient(settings.mongodb_url, **connection_options)
        
        # Test the connection
        await db.client.admin.command('ping')
        logger.info("Successfully connected to MongoDB")
        
        # Initialize the database and collections if they don't exist
        database = db.client[settings.database_name]
        collections = ['users', 'history']
        for collection in collections:
            if collection not in await database.list_collection_names():
                await database.create_collection(collection)
                logger.info(f"Created collection: {collection}")
        
    except Exception as e:
        logger.error(f"Could not connect to MongoDB: {e}")
        logger.error(f"MongoDB URL: {settings.mongodb_url}")
        logger.error(f"Database name: {settings.database_name}")
        logger.warning("Using in-memory database as fallback")
        # Initialize in-memory database as fallback
        db.in_memory_db = InMemoryDB()

async def close_mongo_connection():
    """Close database connection."""
    if db.client:
        db.client.close()
        logger.info("MongoDB connection closed")

def get_collection(collection_name: str):
    """Get a collection from the database."""
    if db.client is not None:
        return db.client[settings.database_name][collection_name]
    elif db.in_memory_db is not None:
        return db.in_memory_db.get_collection(collection_name)
    else:
        raise RuntimeError("Database not initialized")

def get_sync_collection(collection_name: str):
    """Get a synchronous collection from the database."""
    if db.sync_client is not None:
        return db.sync_client[settings.database_name][collection_name]
    elif db.in_memory_db is not None:
        return db.in_memory_db.get_collection(collection_name)
    else:
        raise RuntimeError("Database not initialized") 