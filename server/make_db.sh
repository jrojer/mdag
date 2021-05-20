export FLASK_APP=project 
flask db init
flask db migrate
flask db upgrade
python3 -c "from project import db;from project.models import User;u = User('admin@example.com','arnold');db.session.add(u);db.session.commit();"