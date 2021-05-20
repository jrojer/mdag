from flask import Blueprint, redirect

main = Blueprint('main', __name__)


@main.route('/')
def index():
    # return redirect('login.html')
    return redirect('index.html')
