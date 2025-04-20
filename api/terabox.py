from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
import requests
from datetime import datetime
import re

app = FastAPI()

# Compile regex once
TERABOX_URL_REGEX = re.compile(r'^https:\/\/(terabox\.com|1024terabox\.com)\/s\/([A-Za-z0-9-_]+)$')

@app.get("/")
async def get_terabox_info(
    url: str = Query(..., description="The Terabox share URL"),
    pwd: str = Query(None, description="Optional password for the shared file")
):
    match = TERABOX_URL_REGEX.match(url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid Terabox URL format.")

    shorturl = match.group(2)

    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Accept': '*/*'
    }

    try:
        # Step 1: Get file info
        info_response = requests.get(
            "https://terabox.hnn.workers.dev/api/get-info",
            params={'shorturl': shorturl, 'pwd': pwd},
            headers=headers
        )
        info_data = info_response.json()

        if not info_response.ok or not info_data.get('ok'):
            raise HTTPException(status_code=500, detail="Error from get-info API.")

        file_list = info_data.get('list', [])
        if not file_list:
            raise HTTPException(status_code=404, detail="No files found.")

        file = file_list[0]
        download_response = requests.post(
            "https://terabox.hnn.workers.dev/api/get-download",
            json={
                'shareid': info_data['shareid'],
                'uk': info_data['uk'],
                'sign': info_data['sign'],
                'timestamp': info_data['timestamp'],
                'fs_id': file['fs_id']
            },
            headers=headers
        )
        download_data = download_response.json()

        if not download_response.ok or not download_data.get('ok'):
            raise HTTPException(status_code=500, detail="Error from get-download API.")

        return JSONResponse(content={
            "ok": True,
            "filename": file['filename'],
            "size": f"{round(int(file['size']) / (1024 * 1024), 2)} MB",
            "category": file['category'],
            "create_time": datetime.utcfromtimestamp(int(file['create_time'])).isoformat() + "Z",
            "downloadLink": download_data['downloadLink'],
            "Dev": "pikachufrombd.t.me"
        })

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Network error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
        
