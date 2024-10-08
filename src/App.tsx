import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import './styles/App.css';
import { saveAs } from 'file-saver';

interface Node {
  id: string;
  name: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
  source: Node;
  target: Node;
}

function App() {
  const [nodes, setNodes] = useState<Set<Node>>(new Set());
  const [edges, setEdges] = useState<Set<Edge>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prevNodes => {
      const newNodes = new Set(prevNodes);
      newNodes.forEach(node => {
        if (node.id === nodeId) newNodes.delete(node);
      });
      return newNodes;
    });
    setEdges(prevEdges => {
      const newEdges = new Set(prevEdges);
      newEdges.forEach(edge => {
        if (edge.sourceId === nodeId || edge.targetId === nodeId) newEdges.delete(edge);
      });
      return newEdges;
    });
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const handleNodeClick = useCallback((event: MouseEvent, d: Node) => {
    event.stopPropagation();
    setSelectedNodeId(d.id);
    setSelectedEdgeId(null);
  }, []);

  const handleNodeDoubleClick = useCallback((event: MouseEvent, d: Node) => {
    event.stopPropagation();
    const newName = prompt('Enter new name for the node:', d.name);
    if (newName !== null && newName !== d.name) {
      setNodes(prevNodes => {
        const newNodes = new Set(prevNodes);
        newNodes.delete(d);
        newNodes.add({ ...d, name: newName });
        return newNodes;
      });
    }
  }, []);

  const handleEdgeClick = useCallback((event: MouseEvent, d: Edge) => {
    event.stopPropagation();
    setSelectedEdgeId(d.id);
    setSelectedNodeId(null);
  }, []);

  const handleSvgClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const handleSvgDoubleClick = useCallback((event: MouseEvent) => {
    const [x, y] = d3.pointer(event);
    const newNode: Node = {
      id: Date.now().toString(),
      name: `Node ${nodes.size + 1}`,
      x,
      y
    };
    setNodes(prevNodes => new Set(prevNodes).add(newNode));
  }, [nodes]);

  const saveGraph = useCallback(() => {
    const graphData = {
      nodes: Array.from(nodes),
      edges: Array.from(edges)
    };
    const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
    saveAs(blob, 'graph.json');
  }, [nodes, edges]);

  const loadGraph = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const graphData = JSON.parse(content);
          setNodes(new Set(graphData.nodes));
          setEdges(new Set(graphData.edges));
        } catch (error) {
          console.error('Error parsing JSON:', error);
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  const nodesArray = useMemo(() => Array.from(nodes), [nodes]);
  const edgesArray = useMemo(() => Array.from(edges).map(edge => ({
    ...edge,
    source: nodesArray.find(n => n.id === edge.sourceId)!,
    target: nodesArray.find(n => n.id === edge.targetId)!
  })), [edges, nodesArray]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = window.innerWidth;
    const height = window.innerHeight;

    svg.attr('width', width).attr('height', height);

    const simulation = d3.forceSimulation<Node>(nodesArray)
      .force('link', d3.forceLink<Node, Edge>(edgesArray).id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('collide', d3.forceCollide().radius(60))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.1))
      .force('y', d3.forceY(height / 2).strength(0.1))
      .force('boundary', () => {
        nodesArray.forEach(node => {
          node.x = Math.max(40, Math.min(width - 40, node.x || 0));
          node.y = Math.max(40, Math.min(height - 40, node.y || 0));
        });
      });

    svg.on('dblclick', handleSvgDoubleClick);
    svg.on('click', handleSvgClick);

    const link = svg.selectAll<SVGLineElement, Edge>('.link')
      .data(edgesArray, (d: Edge) => d.id)
      .join(
        enter => enter.append('line').attr('class', 'link'),
        update => update,
        exit => exit.remove()
      )
      .on('click', handleEdgeClick)
      .attr('class', d => `link ${d.id === selectedEdgeId ? 'selected' : ''}`);

    const node = svg.selectAll<SVGGElement, Node>('.node')
      .data(nodesArray, (d: Node) => d.id)
      .join(
        enter => enter.append('g').attr('class', 'node'),
        update => update,
        exit => exit.remove()
      )
      .attr('class', d => `node ${d.id === selectedNodeId ? 'selected' : ''}`)
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any)
      .on('click', handleNodeClick)
      .on('dblclick', handleNodeDoubleClick);

    // Remove existing elements
    node.selectAll('*').remove();

    // Define gradients and filters
    const defs = svg.append('defs');

    // Radial gradient for nodes
    const gradient = defs.append('radialGradient')
      .attr('id', 'node-gradient');
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#ffffff');
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#e0e0e0');

    // Glow filter
    const filter = defs.append('filter')
      .attr('id', 'glow');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'coloredBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');

    // Add main circle
    node.append('circle')
      .attr('r', 40)
      .attr('fill', 'url(#node-gradient)')
      .attr('stroke', '#4CAF50')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#glow)');

    // Add text
    node.append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', '14px')
      .attr('fill', '#333');

    simulation.nodes(nodesArray);
    simulation.force<d3.ForceLink<Node, Edge>>('link')?.links(edgesArray);
    simulation.alpha(1).restart();

    simulation.on('tick', () => {
      link
        .attr('x1', d => (nodesArray.find(n => n.id === d.sourceId) as any).x)
        .attr('y1', d => (nodesArray.find(n => n.id === d.sourceId) as any).y)
        .attr('x2', d => (nodesArray.find(n => n.id === d.targetId) as any).x)
        .attr('y2', d => (nodesArray.find(n => n.id === d.targetId) as any).y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: d3.D3DragEvent<SVGGElement, Node, Node>, d: Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, Node, Node>, d: Node) {
      d.fx = Math.max(40, Math.min(width - 40, event.x));
      d.fy = Math.max(40, Math.min(height - 40, event.y));
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, Node, Node>, d: Node) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;

      const targetNode = nodesArray.find(n => 
        n.id !== d.id && 
        Math.sqrt(Math.pow((n.x || 0) - (d.x || 0), 2) + Math.pow((n.y || 0) - (d.y || 0), 2)) < 110
      );

      if (targetNode) {
        const existingEdge = Array.from(edges).find(e => 
          (e.sourceId === d.id && e.targetId === targetNode.id) || 
          (e.sourceId === targetNode.id && e.targetId === d.id)
        );

        if (!existingEdge) {
          const newEdge: Edge = {
            id: Date.now().toString(),
            sourceId: d.id,
            targetId: targetNode.id,
            source: d,
            target: targetNode
          };
          setEdges(prevEdges => new Set(prevEdges).add(newEdge));
        }
      }
    }

    return () => {
      simulation.stop();
    };
  }, [nodesArray, edgesArray, selectedNodeId, selectedEdgeId, handleNodeClick, handleNodeDoubleClick, handleEdgeClick, handleSvgClick, handleSvgDoubleClick]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete') {
        if (selectedNodeId) {
          deleteNode(selectedNodeId);
        } else if (selectedEdgeId) {
          setEdges(prevEdges => {
            const newEdges = new Set(prevEdges);
            newEdges.forEach(edge => {
              if (edge.id === selectedEdgeId) newEdges.delete(edge);
            });
            return newEdges;
          });
          setSelectedEdgeId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNodeId, selectedEdgeId, deleteNode]);

  const menuButtonStyle = {
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
    width: '100%',
    textAlign: 'left' as const,
  };

  return (
    <div className="App" style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 1000 }}>
        <button
          onClick={toggleMenu}
          style={{
            padding: '10px 15px',
            fontSize: '16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            transition: 'background-color 0.3s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#45a049'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'}
        >
          Menu
        </button>
        {isMenuOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            left: 0,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '5px',
            padding: '15px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            minWidth: '150px'
          }}>
            <button
              onClick={saveGraph}
              style={menuButtonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
            >
              Save Graph
            </button>
            <input
              type="file"
              onChange={loadGraph}
              accept=".json"
              style={{ display: 'none' }}
              id="load-graph"
            />
            <label htmlFor="load-graph" style={{ width: '100%' }}>
              <button
                onClick={() => document.getElementById('load-graph')?.click()}
                style={menuButtonStyle}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
              >
                Load Graph
              </button>
            </label>
          </div>
        )}
      </div>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }}></svg>
    </div>
  );
}

export default App;