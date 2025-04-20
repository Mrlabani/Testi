from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
import requests
from datetime import datetime

app = FastAPI()

@app.get("/")
async def get_terabox_info(
    url: str = Query(..., description="The Terabox share URL"),
    pwd: str = Query(None, description="Optional password for the shared file")
):
    # Regex to validate Terabox URLs
    import re
    terabox_url_regex = r'^https:\/\/(terabox\.com|1024terabox\.com)\/s\/([A-Za-z0-9-_]+)$'
    match = re.match(terabox_url_regex, url)

    if not match:
        raise HTTPException(status_code=400, detail="Invalid Terabox URL format.")

    shorturl = match.group(2)

    try:
        # Step 1: Get file info
        info_url = "https://terabox.hnn.workers.dev/api/get-info"
        info_params = {'shorturl': shorturl, 'pwd': pwd}
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': '*/*'
        }

        info_response = requests.get(info_url, params=info_params, headers=headers)

        if info_response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch file info.")

        info_data = info_response.json()
        if not info_data.get('ok'):
            raise HTTPException(status_code=500, detail="Error from get-info API.")

        shareid = info_data['shareid']
        uk = info_data['uk']
        sign = info_data['sign']
        timestamp = info_data['timestamp']
        file_list = info_data['list']

        if not file_list:
            raise HTTPException(status_code=404, detail="No files found in the provided URL.")

        file = file_list[0]
        fs_id = file['fs_id']
        filename = file['filename']
        size = int(file['size'])
        create_time = int(file['create_time'])
        category = file['category']

        # Step 2: Get download link
        download_url = "https://terabox.hnn.workers.dev/api/get-download"
        download_data = {
            'shareid': shareid,
            'uk': uk,
            'sign': sign,
            'timestamp': timestamp,
            'fs_id': fs_id
        }

        download_response = requests.post(download_url, json=download_data, headers=headers)

        if download_response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch download link.")

        download_data = download_response.json()
        if not download_data.get('ok'):
            raise HTTPException(status_code=500, detail="Error from get-download API.")

        download_link = download_data['downloadLink']

        # Step 3: Respond with file details
        response_data = {
            "ok": True,
            "filename": filename,
            "size": f"{round(size / (1024 * 1024), 2)} MB",
            "category": category,
            "create_time": datetime.utcfromtimestamp(create_time).isoformat() + "Z",
            "downloadLink": download_link,
            "Dev": "pikachufrombd.t.me"
        }
        return JSONResponse(content=response_data, status_code=200)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
