"""Service for handling media file storage (local or S3/R2)."""
import os
import uuid
from pathlib import Path
from typing import BinaryIO
import aiofiles
from fastapi import UploadFile

from urllib.parse import urlparse

from app.core.config import settings
from app.core.logging import logger


class StorageService:
    """Handle file storage - local filesystem or S3-compatible."""
    
    def __init__(self):
        self.storage_type = settings.MEDIA_STORAGE_TYPE
        
        if self.storage_type == "local":
            # Ensure local media directory exists
            self.media_path = Path(settings.MEDIA_LOCAL_PATH)
            self.media_path.mkdir(parents=True, exist_ok=True)
    
    async def save_file(self, file: UploadFile, subfolder: str = "submissions") -> str:
        """
        Save uploaded file and return URL/path.
        
        Args:
            file: Uploaded file
            subfolder: Subfolder within media directory
            
        Returns:
            URL or path to the saved file
        """
        # Generate unique filename
        file_ext = Path(file.filename).suffix if file.filename else ""
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        
        if self.storage_type == "local":
            return await self._save_local(file, subfolder, unique_filename)
        elif self.storage_type == "s3":
            return await self._save_s3(file, subfolder, unique_filename)
        else:
            raise ValueError(f"Unknown storage type: {self.storage_type}")
    
    async def _save_local(self, file: UploadFile, subfolder: str, filename: str) -> str:
        """Save file to local filesystem."""
        # Create subfolder if needed
        folder_path = self.media_path / subfolder
        folder_path.mkdir(parents=True, exist_ok=True)
        
        file_path = folder_path / filename
        
        # Save file asynchronously
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        # Store as relative media path so URLs can be built for any reachable host.
        media_path = f"/media/{subfolder}/{filename}"
        logger.info(f"Saved file locally: {media_path}")
        return media_path
    
    async def _save_s3(self, file: UploadFile, subfolder: str, filename: str) -> str:
        """Save file to S3-compatible storage (e.g., Cloudflare R2)."""
        # This is a placeholder - implement actual S3 upload
        # using boto3 or similar library
        
        try:
            import boto3
            
            s3_client = boto3.client(
                's3',
                endpoint_url=settings.S3_ENDPOINT_URL,
                aws_access_key_id=settings.S3_ACCESS_KEY_ID,
                aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
                region_name=settings.S3_REGION
            )
            
            key = f"{subfolder}/{filename}"
            content = await file.read()
            
            s3_client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Body=content,
                ContentType=file.content_type
            )
            
            # Return public URL
            url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{key}"
            logger.info(f"Saved file to S3: {url}")
            return url
            
        except ImportError:
            logger.error("boto3 not installed. Install with: poetry add boto3")
            raise ValueError("S3 storage configured but boto3 not available")
        except Exception as e:
            logger.error(f"Failed to upload to S3: {e}")
            raise
    
    def delete_file(self, file_url: str) -> bool:
        """Delete a file from storage."""
        if self.storage_type == "local":
            try:
                # Accept relative media paths and legacy absolute URLs.
                path_part = file_url
                if "://" in file_url:
                    path_part = urlparse(file_url).path
                path_part = path_part.lstrip("/")
                if path_part.startswith("media/"):
                    path_part = path_part[len("media/"):]
                if path_part.startswith("/"):
                    path_part = path_part[1:]
                file_path = self.media_path / path_part
                
                if file_path.exists():
                    file_path.unlink()
                    logger.info(f"Deleted file: {file_path}")
                    return True
            except Exception as e:
                logger.error(f"Failed to delete file {file_url}: {e}")
                return False
        
        # TODO: Implement S3 deletion
        return False


# Singleton instance
storage_service = StorageService()
