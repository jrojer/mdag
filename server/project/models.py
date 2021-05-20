from . import db, login
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin


class User(UserMixin, db.Model):
    __tablename__ = 'user'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)

    def __init__(self, email, password):
        self.email = email
        self.password = generate_password_hash(password, method='sha256')

    @classmethod
    def authenticate(cls, **kwargs):
        email = kwargs.get('email')
        password = kwargs.get('password')

        if not email or not password:
            return None

        user = cls.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password, password):
            return None

        return user

    def to_dict(self):
        return dict(id=self.id, email=self.email)


class Node(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    date_created = db.Column(db.DateTime, index=True, default=datetime.utcnow)
    date_updated = db.Column(db.DateTime, index=True, default=datetime.utcnow)
    #user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    x = db.Column(db.Integer, default=50)
    y = db.Column(db.Integer, default=50)
    title = db.Column(db.String(50), default="Some note")

    def __init__(self, id, title):
        self.date_created = datetime.now()
        self.date_updated = datetime.now()
        #self.user_id = user_id
        self.id = id
        self.title = title

    def __repr__(self):
        return '<Note {}>'.format(self.title)

    def to_dict(self):
        return dict(title=self.title,
                    date_created=self.date_created,
                    date_updated=self.date_updated,
                    node_id=self.id,
                    x=self.x,
                    y=self.y)


class Edge(db.Model):
    source = db.Column(db.String(36), db.ForeignKey('node.id'), primary_key=True)
    target = db.Column(db.String(36), db.ForeignKey('node.id'), primary_key=True)

    def __init__(self, source_id, target_id):
        self.source = source_id
        self.target = target_id

    def __repr__(self):
        return '<Edge {} -> {}>'.format(self.source, self.target)

    def to_dict(self):
        return dict(source=self.source, target=self.target)


# @login.user_loader
# def load_user(id):
#     return User.query.get(int(id))
