document.onload = (function (d3, saveAs, Blob, undefined) {
  "use strict";

  let editButton = document.getElementById("edit-note");

  function postObject(object, url, onDone) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.onreadystatechange = function () {
      if (this.readyState === XMLHttpRequest.DONE) {
        onDone(this.status);
      }
    }
    xhr.send(JSON.stringify(object));
  }

  function getGeometry() {
    let docEl = document.documentElement;
    let bodyEl = document.getElementsByTagName('body')[0];

    let width = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    let height = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;

    let xLoc = width / 2 - 25;
    let yLoc = 100;

    console.log("xLoc", xLoc, "yLoc", yLoc);

    return [width, height, xLoc, yLoc];
  }

  // define graphcreator object
  let GraphCreator = function (svg, nodes, edges) {
    let thisGraph = this;
    thisGraph.idct = 0;

    thisGraph.nodes = nodes || [];
    thisGraph.edges = edges || [];

    thisGraph.state = {
      selectedNode: null,
      selectedEdge: null,
      mouseDownNode: null,
      mouseDownLink: null,
      justDragged: false,
      justScaleTransGraph: false,
      lastKeyDown: -1,
      selectedText: null,
      dragMoveHappened: false
    };


    // define arrow markers for graph links
    let defs = svg.append('svg:defs');
    defs.append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', "32")
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    // define arrow markers for leading arrow
    defs.append('svg:marker')
      .attr('id', 'mark-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 7)
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    thisGraph.svg = svg;
    thisGraph.svgG = svg.append("g")
      .classed(thisGraph.consts.graphClass, true);
    let svgG = thisGraph.svgG;

    // displayed when dragging between nodes
    thisGraph.dragLine = svgG.append('svg:path')
      .attr('class', 'link dragline hidden')
      .attr('d', 'M0,0L0,0')
      .style('marker-end', 'url(#mark-end-arrow)');

    // svg nodes and edges 
    thisGraph.paths = svgG.append("g").selectAll("g");
    thisGraph.circles = svgG.append("g").selectAll("g");

    thisGraph.drag = d3.behavior.drag()
      .origin(function (d) {
        return { x: d.x, y: d.y };
      })
      .on("drag", function (args) {
        thisGraph.state.justDragged = true;
        thisGraph.dragmove.call(thisGraph, args);
      })
      .on("dragend", function () {
        // todo check if edge-mode is selected
      });
    svg.on("mousedown", function (d) { thisGraph.svgMouseDown.call(thisGraph, d); });
    svg.on("mouseup", function (d) { thisGraph.svgMouseUp.call(thisGraph, d); });

    // listen for dragging
    let dragSvg = d3.behavior.zoom()
      .on("zoom", function () {
        thisGraph.zoomed.call(thisGraph);
        return true;
      })
      .on("zoomstart", function () {
        let ael = d3.select("#" + thisGraph.consts.activeEditId).node();
        if (ael) {
          ael.blur();
        }
        d3.select('body').style("cursor", "move");
      })
      .on("zoomend", function () {
        d3.select('body').style("cursor", "auto");
      });

    svg.call(dragSvg).on("dblclick.zoom", null);

    // listen for resize
    window.onresize = function () { thisGraph.updateWindow(svg); };

    // handle download data
    d3.select("#download-input").on("click", function () {
      let saveEdges = [];
      thisGraph.edges.forEach(function (val, i) {
        saveEdges.push({ source: val.source.id, target: val.target.id });
      });
      let blob = new Blob([window.JSON.stringify({ "nodes": thisGraph.nodes, "edges": saveEdges })], { type: "text/plain;charset=utf-8" });
      saveAs(blob, "mydag.json");
    });


    d3.select("#upload-input").on("click", function () {
      window.location.href = "/edit.html";
    });

    d3.select("#edit-note").on("click", function () {
      let node = thisGraph.state.selectedNode;
      let param = "?node_id=" + node["node_id"];
      window.location.href = `/edit.html${param}`;
    });

    function updateNodeCoordinates() {
      if (thisGraph.state.dragMoveHappened) {
        let [width, height, xLoc, yLoc] = getGeometry();
        let nodes = [];
        for (let i = 0; i < thisGraph.nodes.length; i++) {
          nodes.push(thisGraph.nodes[i])
          //nodes[i].x -= xLoc;
          //nodes[i].y -= yLoc;
        }
        postObject(nodes, "/api/update_coordinates", function (status) {
        });
        thisGraph.state.dragMoveHappened = false;
      }
    }
    setInterval(updateNodeCoordinates, 1000);

  };

  GraphCreator.prototype.setIdCt = function (idct) {
    this.idct = idct;
  };

  GraphCreator.prototype.consts = {
    selectedClass: "selected",
    connectClass: "connect-node",
    circleGClass: "conceptG",
    graphClass: "graph",
    activeEditId: "active-editing",
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    nodeRadius: 50
  };



  /* PROTOTYPE FUNCTIONS */

  GraphCreator.prototype.dragmove = function (d) {
    d.x += d3.event.dx;
    d.y += d3.event.dy;
    let thisGraph = this;
    thisGraph.updateGraph();
    thisGraph.state.dragMoveHappened = true;
  };

  GraphCreator.prototype.deleteGraph = function (skipPrompt) {
    let thisGraph = this,
      doDelete = true;
    if (!skipPrompt) {
      doDelete = window.confirm("Press OK to delete this graph");
    }
    if (doDelete) {
      thisGraph.nodes = [];
      thisGraph.edges = [];
      thisGraph.updateGraph();
    }
  };

  /* select all text in element: taken from http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element */
  GraphCreator.prototype.selectElementContents = function (el) {
    let range = document.createRange();
    range.selectNodeContents(el);
    let sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };


  /* insert svg line breaks: taken from http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts */
  GraphCreator.prototype.insertTitleLinebreaks = function (gEl, title) {
    let words = title.split(/\s+/g),
      nwords = words.length;
    let el = gEl.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-" + (nwords - 1) * 7.5);

    for (let i = 0; i < words.length; i++) {
      let tspan = el.append('tspan').text(words[i]);
      if (i > 0)
        tspan.attr('x', 0).attr('dy', '15');
    }
  };


  // remove edges associated with a node
  GraphCreator.prototype.spliceLinksForNode = function (node) {
    let thisGraph = this,
      toSplice = thisGraph.edges.filter(function (l) {
        return (l.source === node || l.target === node);
      });
    toSplice.map(function (l) {
      thisGraph.edges.splice(thisGraph.edges.indexOf(l), 1);
    });
  };

  GraphCreator.prototype.replaceSelectEdge = function (d3Path, edgeData) {
    let thisGraph = this;
    d3Path.classed(thisGraph.consts.selectedClass, true);
    if (thisGraph.state.selectedEdge) {
      thisGraph.removeSelectFromEdge();
    }
    thisGraph.state.selectedEdge = edgeData;
  };

  GraphCreator.prototype.replaceSelectNode = function (d3Node, nodeData) {
    let thisGraph = this;
    d3Node.classed(this.consts.selectedClass, true);
    if (thisGraph.state.selectedNode) {
      thisGraph.removeSelectFromNode();
    }
    thisGraph.state.selectedNode = nodeData;
  };

  GraphCreator.prototype.removeSelectFromNode = function () {
    editButton.hidden = true;
    let thisGraph = this;
    if (!thisGraph.state.selectedNode) {
      return;
    }
    thisGraph.circles.filter(function (cd) {
      return cd.id === thisGraph.state.selectedNode.id;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedNode = null;
  };

  GraphCreator.prototype.removeSelectFromEdge = function () {
    let thisGraph = this;
    thisGraph.paths.filter(function (cd) {
      return cd === thisGraph.state.selectedEdge;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedEdge = null;
  };

  // mousedown on node
  GraphCreator.prototype.circleMouseDown = function (d3node, d) {
    console.log("node click", d);
    let thisGraph = this;
    let state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownNode = d;
  };

  // mouseup on nodes
  GraphCreator.prototype.circleMouseUp = function (d3node, d) {
    let thisGraph = this;
    let state = thisGraph.state;
    let consts = thisGraph.consts;
    // reset the states
    d3node.classed(consts.connectClass, false);

    let mouseDownNode = state.mouseDownNode;

    if (!mouseDownNode) return;

    thisGraph.dragLine.classed("hidden", true);

    if (mouseDownNode === d) {
      // we're in the same node
      if (state.justDragged) {
        // dragged, not clicked
        console.log("dragged, not clicked");
        state.justDragged = false;
      } else {
        // clicked, not dragged
        console.log("clicked, not dragged");
        editButton.hidden = false;
        if (state.selectedEdge) {
          thisGraph.removeSelectFromEdge();
        }
        let prevNode = state.selectedNode;

        if (!prevNode || prevNode.id !== d.id) {
          thisGraph.replaceSelectNode(d3node, d);
        } else {
          thisGraph.removeSelectFromNode();
        }

      }
    }
    state.mouseDownNode = null;
    return;

  }; // end of circles mouseup

  // mousedown on main svg
  GraphCreator.prototype.svgMouseDown = function () {
    this.state.graphMouseDown = true;
    console.log("main svg click");
    this.removeSelectFromNode();
  };

  // mouseup on main svg
  GraphCreator.prototype.svgMouseUp = function () {
    let thisGraph = this,
      state = thisGraph.state;
    if (state.justScaleTransGraph) {
      // dragged not clicked
      state.justScaleTransGraph = false;
    }
    state.graphMouseDown = false;
  };

  // call to propagate changes to graph
  GraphCreator.prototype.updateGraph = function () {

    let thisGraph = this,
      consts = thisGraph.consts,
      state = thisGraph.state;

    thisGraph.paths = thisGraph.paths.data(thisGraph.edges, function (d) {
      return String(d.source.id) + "+" + String(d.target.id);
    });
    let paths = thisGraph.paths;
    // update existing paths
    paths.style('marker-end', 'url(#end-arrow)')
      .classed(consts.selectedClass, function (d) {
        return d === state.selectedEdge;
      })
      .attr("d", function (d) {
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      });

    // add new paths
    paths.enter()
      .append("path")
      .style('marker-end', 'url(#end-arrow)')
      .classed("link", true)
      .attr("d", function (d) {
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      })
      .on("mouseup", function (d) {
        state.mouseDownLink = null;
      });

    // remove old links
    paths.exit().remove();

    // update existing nodes
    thisGraph.circles = thisGraph.circles.data(thisGraph.nodes, function (d) { return d.id; });
    thisGraph.circles.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

    // add new nodes
    let newGs = thisGraph.circles.enter()
      .append("g");

    newGs.classed(consts.circleGClass, true)
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
      .on("mouseover", function (d) {
      })
      .on("mouseout", function (d) {
        d3.select(this).classed(consts.connectClass, false);
      })
      .on("mousedown", function (d) {
        thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
      })
      .on("mouseup", function (d) {
        thisGraph.circleMouseUp.call(thisGraph, d3.select(this), d);
      })
      .call(thisGraph.drag);

    newGs.append("circle")
      .attr("r", String(consts.nodeRadius));

    newGs.each(function (d) {
      thisGraph.insertTitleLinebreaks(d3.select(this), d.title);
    });

    // remove old nodes
    thisGraph.circles.exit().remove();
  };

  GraphCreator.prototype.zoomed = function () {
    this.state.justScaleTransGraph = true;
    d3.select("." + this.consts.graphClass)
      .attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
  };

  GraphCreator.prototype.updateWindow = function (svg) {
    console.log("update window");
    let docEl = document.documentElement,
      bodyEl = document.getElementsByTagName('body')[0];
    let x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    let y = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;
    svg.attr("width", x).attr("height", y);
  };



  /**** MAIN ****/

  function getNodes(onResult) {
    var req = new XMLHttpRequest();
    req.addEventListener("load", function () {
      if (this.status === 200) {
        let response = JSON.parse(this.responseText);
        console.log("response ", response);
        onResult(response);
      }
      else {
        console.log("Error get_nodes ", this.status);
      }
    });
    req.open("GET", "/api/get_nodes");
    req.send();
  }




  /*
  let nodes = [{ title: "new concept", id: 0, x: xLoc, y: yLoc, node_id: "var123" },
  { title: "problem of2 square roots", id: 1, x: xLoc, y: yLoc + 200 },
  { title: "new concept", id: 2, x: xLoc + 200, y: yLoc + 200 }
  ];
  */

  getNodes(function (response) {
    let [width, height, xLoc, yLoc] = getGeometry();
    let nodes = response["nodes"]
    let edges = response["edges"]
    for (let i = 0; i < edges.length; i++) {
      let edge = edges[i];
      edge.source = nodes[edge.source];
      edge.target = nodes[edge.target];
    }
    //let edges = [];// [{ source: nodes[1], target: nodes[0] }];
    /** MAIN SVG **/
    let svg = d3.select("body").append("svg")
      .attr("width", width)
      .attr("height", height);
    let graph = new GraphCreator(svg, nodes, edges);
    graph.setIdCt(2);
    graph.updateGraph();
  });

})(window.d3, window.saveAs, window.Blob);