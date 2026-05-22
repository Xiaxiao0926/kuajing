import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

JD_APP_KEY = os.environ.get("JD_APP_KEY", "")
JD_APP_SECRET = os.environ.get("JD_APP_SECRET", "")

DATA_DIR = os.path.join(BASE_DIR, "data")
IMAGES_DIR = os.path.join(BASE_DIR, "images")

JD_API_GATEWAY = "https://api.jd.com/routerjson"
JD_TOKEN_URL = "https://api.jd.com/oauth2/accessToken"

if not JD_APP_KEY or not JD_APP_SECRET:
    print("[警告] JD_APP_KEY 或 JD_APP_SECRET 未配置，请在环境变量中设置后再启动服务。")
