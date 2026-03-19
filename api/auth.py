import os
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme), 
    token_query: str = Query(None, alias="token")
):
    correct_password = os.getenv("APP_PASSWORD", "secret")
    final_token = token or token_query
    
    # Fallback for OnlyOffice Document Server which drops query params:
    # Check if the URL path ends with the token
    if not final_token:
        path_parts = request.url.path.strip("/").split("/")
        if path_parts and path_parts[-1] == correct_password:
            final_token = correct_password
    
    if not final_token or final_token != correct_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return "admin"

@router.post("/login", tags=["auth"])
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    correct_password = os.getenv("APP_PASSWORD", "secret")
    if form_data.password != correct_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Incorrect password"
        )
    
    return {"access_token": correct_password, "token_type": "bearer"}
