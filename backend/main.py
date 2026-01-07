import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv, find_dotenv
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv(find_dotenv())

FRONTEND_URL = os.getenv("VITE_FRONTEND_URL") 

DATABASE_URL = os.getenv("VITE_DATABASE_URL")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI()

# Allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Table
class VerifiedAddresses(Base):
    __tablename__ = "verified_addresses"
    id = Column(Integer, primary_key=True, index=True)
    address = Column(String, index=True)

class AddressRequest(BaseModel):
    address: str

@app.get("/")
def root():
    return {"message": "Hello"}