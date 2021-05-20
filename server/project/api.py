from flask import jsonify, Blueprint, request
from flask_login import current_user, login_user, logout_user
from .models import User

import uuid
import os
from . import db
from .models import Node
from pathlib import Path

from .models import Node, Edge


api = Blueprint('api', __name__)


@api.route('/api/login', methods=('POST',))
def login():
    data = request.get_json()
    if data:
        user = User.authenticate(**data)
        if user:
            login_user(user)
            return jsonify({'success': True}), 200
    return jsonify({'success': False}), 200


@api.route('/api/logout')
def logout():
    logout_user()
    return jsonify({'success': True}), 200


@api.route('/api/private')
def private():
    if current_user.is_authenticated:
        return jsonify({'success': True}), 200
    else:
        return jsonify({'success': False}), 200


@api.route('/api/get_nodes')
def get_nodes():
    node_id_to_id_map = dict()
    node_list = [node.to_dict() for node in db.session.query(Node).all()]
    i = 0
    for node in node_list:
        node_id_to_id_map[node["node_id"]] = i
        node["id"] = i
        i += 1
    edge_list = [edge.to_dict() for edge in db.session.query(Edge).all()]
    for edge in edge_list:
        edge["source"] = node_id_to_id_map[edge["source"]]
        edge["target"] = node_id_to_id_map[edge["target"]]
    return jsonify({"nodes": node_list, "edges": edge_list}), 200


def add_edges_to_db(source_id, text):
    db.session.query(Edge).filter_by(source=source_id).delete()
    for node in db.session.query(Node).all():
        if node.id in text:
            edge = Edge(source_id, node.id)
            db.session.add(edge)
    db.session.commit()


def update_title(node_id, title):
    node = db.session.get(Node, node_id)
    node.title = title
    db.session.commit()


def add_note_to_db(note_id_name, title):
    node = Node(note_id_name, title)
    db.session.add(node)
    db.session.commit()


def create_new_note_id_name():
    id_name = str(uuid.uuid4())
    # check db
    return id_name


def write_note_to_disk(note_id_name, text):
    dirpath = 'notes/'
    filepath = dirpath + note_id_name
    Path(dirpath).mkdir(parents=True, exist_ok=True)
    with open(filepath, 'w') as f:
        f.write(text)


def get_title(text):
    wpos = 0
    for i in range(len(text)):
        if text[i].isalnum():
            wpos = i
            break
    nlpos = text.find('\n')
    nlpos = len(text) if nlpos == -1 else nlpos
    return ''.join(ch for ch in text[wpos: min(wpos+20, nlpos)])


@api.route('/api/add_note', methods=('POST',))
def add_note():
    data = request.get_json()
    text = data['text']
    title = get_title(text)
    node_id = ''
    if "node_id" in data:
        node_id = data["node_id"]
        write_note_to_disk(node_id, text)
        update_title(node_id, title)
    else:
        note_id = create_new_note_id_name()
        write_note_to_disk(note_id, text)
        add_note_to_db(note_id, title)

    add_edges_to_db(node_id, text)
    return "OK", 200


@api.route('/api/get_note', methods=('GET',))
def get_note():
    node_id = request.args.get('node_id')
    text = ''
    if node_id:
        file_path = 'notes/'+node_id
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                text = f.read()
    return jsonify({'text': text}), 200


@api.route('/api/update_coordinates', methods=('POST',))
def update_coordinates():
    node_list = request.get_json()
    nodes = {}
    for node in node_list:
        nodes[node["node_id"]] = (node["x"], node["y"])
    for node in db.session.query(Node).all():
        x, y = nodes[node.id]
        node.x = x
        node.y = y
    db.session.commit()
    return "OK", 200


@api.route('/api/delete_node', methods=('POST',))
def delete_node():
    data = request.get_json()
    node_id = data["node_id"]
    if "node_id" in data:
        # TODO make sure such node_id exists
        for edge in db.session.query(Edge).all():
            if node_id in [edge.source, edge.target]:
                db.session.delete(edge)

        node = db.session.get(Node, node_id)
        db.session.delete(node)
        db.session.commit()
        os.remove("notes/" + node_id)
    else:
        return "no node_id", 400
    return "OK", 200
