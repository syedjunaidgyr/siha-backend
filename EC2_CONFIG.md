# EC2 Backend Configuration

## Service URLs

Both services run on the same EC2 instance:
- **Backend**: `http://13.203.161.24:4000`
- **AI Service**: `http://13.203.161.24:3001`

## Environment Variables

The backend is configured to connect to the AI service using the IP address by default.

### Default Configuration

The backend services use these defaults:
- `AIAnalysisService`: `http://13.203.161.24:3001/api`
- `PreventiveHealthService`: `http://13.203.161.24:3001/api`

### Override with Environment Variable

You can override the AI service URL by setting the `AI_SERVICE_PYTHON_URL` environment variable in your backend's PM2 ecosystem config or `.env` file:

```bash
# In PM2 ecosystem.config.js
env: {
  AI_SERVICE_PYTHON_URL: 'http://13.203.161.24:3001/api'
}

# Or in .env file
AI_SERVICE_PYTHON_URL=http://13.203.161.24:3001/api
```

## Verification

To verify the backend can connect to the AI service:

```bash
# From backend server, test the connection
curl http://13.203.161.24:3001/health

# Should return:
# {"status":"ok","service":"ai-analysis-python","modelsLoaded":true,...}
```

## Security Group Configuration

Ensure your EC2 security group allows:
- **Port 4000** (Backend) - from your mobile app / clients
- **Port 3001** (AI Service) - from backend security group or same instance

Since both services are on the same instance, internal communication via IP should work, but you can also use `localhost` if preferred.

## Troubleshooting

### Backend Can't Connect to AI Service

1. **Verify AI service is running:**
   ```bash
   pm2 status | grep siha-ai
   curl http://13.203.161.24:3001/health
   ```

2. **Check if AI service is listening:**
   ```bash
   sudo netstat -tlnp | grep 3001
   ```

3. **Verify security group:**
   - Ensure port 3001 is accessible from the backend
   - Since both are on the same instance, this should work automatically

4. **Check backend logs:**
   ```bash
   pm2 logs siha-backend --err | grep -i "ECONNREFUSED"
   ```

### Using localhost Instead

If you prefer to use `localhost` instead of the IP (since both services are on the same server):

1. Update the default URLs in:
   - `backend/src/services/aiAnalysisService.ts`
   - `backend/src/services/preventiveHealthService.ts`

2. Change from:
   ```typescript
   const DEFAULT_AI_BASE_URL = 'http://13.203.161.24:3001/api';
   ```
   
   To:
   ```typescript
   const DEFAULT_AI_BASE_URL = 'http://localhost:3001/api';
   ```

3. Restart the backend service:
   ```bash
   pm2 restart siha-backend
   ```

