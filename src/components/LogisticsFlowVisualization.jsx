import React, { useEffect, useRef } from 'react';

const LogisticsFlowVisualization = ({ allocationData, summary }) => {
  const svgRef = useRef(null);
  
  useEffect(() => {
    if (!allocationData || allocationData.length === 0) return;
    
    generateVisualization();
  }, [allocationData, summary]);
  
  // Helper function to convert hex to rgb for opacity support
  const hexToRgb = (hex) => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `${r}, ${g}, ${b}`;
  };
  
  const generateVisualization = () => {
    // Clear any existing SVG content
    if (svgRef.current) {
      svgRef.current.innerHTML = '';
    }
    
    // Extract unique sources and destinations
    const sources = [...new Set(allocationData.map(item => item.source))];
    const destinations = [...new Set(allocationData.map(item => item.destination))];
    
    // Group destinations by customer
    const customerGroups = allocationData.reduce((groups, item) => {
      const customer = item.destination_customer || 'Unknown';
      if (!groups[customer]) {
        groups[customer] = [];
      }
      if (!groups[customer].includes(item.destination)) {
        groups[customer].push(item.destination);
      }
      return groups;
    }, {});
    
    // Set dimensions
    const width = 900;
    const height = 700;
    const margin = { top: 100, right: 50, bottom: 120, left: 50 };
    
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    
    // Create organized structure with group elements
    const backgroundGroup = createSvgElement('g', {}, svg);
    const titleGroup = createSvgElement('g', {}, svg);
    const sourceGroup = createSvgElement('g', {}, svg);
    const destGroup = createSvgElement('g', {}, svg);
    const customerGroup = createSvgElement('g', {}, svg);
    const linkGroup = createSvgElement('g', {}, svg);
    const legendGroup = createSvgElement('g', {}, svg);
    
    // Add definitions for gradients
    const defs = createSvgElement('defs', {}, svg);
    
    // Create gradients
    const gradients = {
      link: createGradient(defs, 'linkGradient', 
        [{ offset: '0%', color: '#4f46e5' }, { offset: '100%', color: '#10b981' }]),
      source: createGradient(defs, 'sourceGradient', 
        [{ offset: '0%', color: '#4f46e5' }, { offset: '100%', color: '#818cf8' }]),
      dest: createGradient(defs, 'destGradient', 
        [{ offset: '0%', color: '#059669' }, { offset: '100%', color: '#10b981' }])
    };
    
    // Create customer gradients
    const customerColors = Object.keys(customerGroups).reduce((colors, customer, index) => {
      const gradientId = `customer${index}Gradient`;
      
      // Generate a unique color for each customer (using golden ratio for color distribution)
      const hue = (index * 137) % 360;
      
      createGradient(defs, gradientId, [
        { offset: '0%', color: `hsl(${hue}, 70%, 40%)` },
        { offset: '100%', color: `hsl(${hue}, 80%, 60%)` }
      ]);
      
      colors[customer] = {
        gradientId,
        baseColor: `hsl(${hue}, 70%, 50%)`,
        lightColor: `hsl(${hue}, 80%, 70%)`
      };
      
      return colors;
    }, {});
    
    // Add background
    createSvgElement('rect', {
      width: width,
      height: height,
      fill: '#111827',
      rx: '10',
      ry: '10'
    }, backgroundGroup);
    
    // Add title and subtitle
    createSvgElement('text', {
      x: width/2,
      y: 60,
      'text-anchor': 'middle',
      'font-size': '28',
      'font-weight': 'bold',
      fill: 'white',
      textContent: 'Logistics Network Flow'
    }, titleGroup);
    
    createSvgElement('text', {
      x: width/2,
      y: 90,
      'text-anchor': 'middle',
      'font-size': '16',
      fill: '#9ca3af',
      textContent: 'Allocation by Source, Destination, and Customer'
    }, titleGroup);
    
    // Add section labels
    const labelY = 140;
    
    // Source section
    const sourceX = 150;
    createSvgElement('text', {
      x: sourceX,
      y: labelY,
      'text-anchor': 'middle',
      'font-size': '18',
      'font-weight': 'bold',
      fill: '#818cf8',
      textContent: 'SOURCES'
    }, sourceGroup);
    
    createSvgElement('text', {
      x: sourceX,
      y: labelY + 20,
      'text-anchor': 'middle',
      'font-size': '14',
      fill: '#c7d2fe',
      textContent: `${summary.totalQuantity} units`
    }, sourceGroup);
    
    // Destination section
    const destX = 450;
    createSvgElement('text', {
      x: destX,
      y: labelY,
      'text-anchor': 'middle',
      'font-size': '18',
      'font-weight': 'bold',
      fill: '#34d399',
      textContent: 'DESTINATIONS'
    }, destGroup);
    
    createSvgElement('text', {
      x: destX,
      y: labelY + 20,
      'text-anchor': 'middle',
      'font-size': '14',
      fill: '#a7f3d0',
      textContent: `${summary.totalQuantity} units`
    }, destGroup);
    
    // Customer section
    const customerX = 720;
    createSvgElement('text', {
      x: customerX,
      y: labelY,
      'text-anchor': 'middle',
      'font-size': '18',
      'font-weight': 'bold',
      fill: '#f87171',
      textContent: 'CUSTOMERS'
    }, customerGroup);
    
    // Create source nodes
    const sourceSpacing = (height - 200) / (sources.length + 1);
    const sourceNodes = sources.map((source, index) => {
      const y = 200 + (index * sourceSpacing);
      
      // Find total quantity for this source
      const sourceData = summary.sourceStats.find(s => s.source === source);
      const quantity = sourceData ? sourceData.totalQuantity : 0;
      
      // Create hexagon for source
      const hexSize = Math.min(20 + (quantity / summary.totalQuantity * 20), 40);
      const hx = sourceX; // x center
      const hy = y; // y center
      
      // Create hexagon path
      const path = [
        `M${hx-hexSize},${hy-hexSize/2}`,
        `L${hx},${hy-hexSize}`,
        `L${hx+hexSize},${hy-hexSize/2}`,
        `L${hx+hexSize},${hy+hexSize/2}`,
        `L${hx},${hy+hexSize}`,
        `L${hx-hexSize},${hy+hexSize/2}`,
        'Z'
      ].join(' ');
      
      createSvgElement('path', {
        d: path,
        fill: 'url(#sourceGradient)',
        stroke: '#818cf8',
        'stroke-width': '2'
      }, sourceGroup);
      
      // Add label
      createSvgElement('text', {
        x: hx,
        y: hy + 5,
        'text-anchor': 'middle',
        'font-size': '14',
        'font-weight': 'bold',
        fill: 'white',
        textContent: source
      }, sourceGroup);
      
      return { id: source, x: hx, y: hy, quantity };
    });
    
    // Calculate destination positions and create destination nodes
    // Create a map of destination vertical positions first
    const destNodes = [];
    const destPositions = {};
    const destSpacing = (height - 200) / (destinations.length + 1);
    
    destinations.forEach((dest, index) => {
      const y = 200 + (index * destSpacing);
      destPositions[dest] = y;
    });
    
    // Create customer groups with more compact sizing
    let customerY = 180;
    const customerBoxPadding = 15;
    const customerTitleHeight = 40;
    const customerSpacing = 20;
    
    // First, calculate the vertical position of each destination
    Object.entries(customerGroups).forEach(([customer, customerDestinations]) => {
      // Calculate a more appropriate box height based on actual destinations
      // Minimum height for the customer box (enough for title and padding)
      const minBoxHeight = customerTitleHeight + 2 * customerBoxPadding;
      
      // Find all related destinations and their average Y position
      const destYPositions = customerDestinations.map(dest => destPositions[dest]);
      const avgDestY = destYPositions.reduce((sum, y) => sum + y, 0) / destYPositions.length;
      
      // Determine exact box height - compact but sufficient
      const boxHeight = Math.max(minBoxHeight, customerDestinations.length * 25 + 2 * customerBoxPadding);
      
      // Adjust the vertical position of the customer box to align with its destinations
      // but stay within reasonable bounds
      const idealY = avgDestY - boxHeight / 2;
      const minY = 180; // Minimum Y to avoid overlap with headers
      const maxY = height - 150 - boxHeight; // Maximum Y to avoid overlap with legend
      
      // Ensure the box is within bounds
      customerY = Math.max(minY, Math.min(maxY, idealY));
      
      // Create customer group container
      const customerContainer = createSvgElement('g', {
        'data-customer': customer
      }, customerGroup);
      
      // Get customer color
      const customerColor = customerColors[customer];
      
      // Create customer group box with adjusted height
      createSvgElement('rect', {
        x: 620,
        y: customerY,
        width: 200,
        height: boxHeight,
        rx: '5',
        ry: '5',
        fill: `rgba(${hexToRgb(customerColor.baseColor)}, 0.2)`,
        stroke: customerColor.baseColor,
        'stroke-width': '2'
      }, customerContainer);
      
      // Add customer name background - centered within the box
      createSvgElement('rect', {
        x: 630,
        y: customerY + customerBoxPadding,
        width: 180,
        height: 30,
        rx: '15',
        ry: '15',
        fill: `url(#${customerColor.gradientId})`
      }, customerContainer);
      
      // Add customer name - centered within the background
      createSvgElement('text', {
        x: 720,
        y: customerY + customerBoxPadding + 20,
        'text-anchor': 'middle',
        'font-size': '14',
        'font-weight': 'bold',
        fill: 'white',
        textContent: customer
      }, customerContainer);
      
      // Store customer box position for connections
      customerGroups[customer] = {
        destinations: customerDestinations,
        y: customerY,
        height: boxHeight,
        color: customerColor
      };
      
      // Increment customer Y for next customer if needed
      customerY += boxHeight + customerSpacing;
    });
    
    // Now create destination nodes with the pre-calculated positions
    destinations.forEach((dest) => {
      const y = destPositions[dest];
      
      // Find total quantity for this destination
      const destData = summary.destinationStats.find(d => d.destination === dest);
      const quantity = destData ? destData.totalQuantity : 0;
      
      // Find customer for this destination
      const customer = Object.keys(customerGroups).find(c => 
        customerGroups[c].destinations.includes(dest)
      ) || 'Unknown';
      
      // Create diamond for destination
      const diamondSize = Math.min(20 + (quantity / summary.totalQuantity * 20), 40);
      const dx = destX; // x center
      const dy = y; // y center
      
      // Create destination container
      const destContainer = createSvgElement('g', {
        'data-destination': dest,
        'data-customer': customer
      }, destGroup);
      
      // Create diamond path
      const path = [
        `M${dx},${dy-diamondSize}`,
        `L${dx+diamondSize},${dy}`,
        `L${dx},${dy+diamondSize}`,
        `L${dx-diamondSize},${dy}`,
        'Z'
      ].join(' ');
      
      createSvgElement('path', {
        d: path,
        fill: 'url(#destGradient)',
        stroke: '#34d399',
        'stroke-width': '2'
      }, destContainer);
      
      // Add destination label
      createSvgElement('text', {
        x: dx,
        y: dy + 5,
        'text-anchor': 'middle',
        'font-size': '14',
        'font-weight': 'bold',
        fill: 'white',
        textContent: dest
      }, destContainer);
      
      // Get customer info for this destination
      const customerInfo = customerGroups[customer];
      if (customerInfo) {
        const customerColor = customerColors[customer];
        
        // Create customer badge for this destination
        createSvgElement('circle', {
          cx: dx + diamondSize + 15,
          cy: dy - diamondSize,
          r: 8,
          fill: customerColor.baseColor,
          stroke: 'white',
          'stroke-width': '1'
        }, destContainer);
        
        // Connect destination to customer with dotted line
        // Calculate an entry point to the customer box
        const customerBoxX = 620;
        const customerBoxY = customerInfo.y;
        const customerBoxHeight = customerInfo.height;
        
        // Find a good entry point on the customer box
        const entryY = Math.min(
          Math.max(customerBoxY + 20, dy),
          customerBoxY + customerBoxHeight - 20
        );
        
        createSvgElement('path', {
          d: `M${dx + diamondSize},${dy} Q${(dx + diamondSize + customerBoxX)/2},${dy} ${customerBoxX},${entryY}`,
          stroke: customerColor.baseColor,
          'stroke-width': '2',
          'stroke-dasharray': '5,5',
          fill: 'none'
        }, destContainer);
      }
      
      // Store dest node info for flow lines
      destNodes.push({ id: dest, x: dx, y: dy, quantity, customer });
    });
    
    // Create flow lines between sources and destinations
    allocationData.forEach(allocation => {
      const source = sourceNodes.find(node => node.id === allocation.source);
      const dest = destNodes.find(node => node.id === allocation.destination);
      
      if (source && dest) {
        // Find customer for this destination
        const customer = allocation.destination_customer || 'Unknown';
        const customerColor = customerColors[customer]?.baseColor || '#ffffff';
        
        // Calculate line thickness based on quantity
        const maxThickness = 20;
        const minThickness = 3;
        const thickness = minThickness + 
          (allocation.quantity / summary.totalQuantity) * (maxThickness - minThickness);
        
        // Create flow container
        const flowContainer = createSvgElement('g', {
          'data-flow': `${source.id}-to-${dest.id}`,
          'data-quantity': allocation.quantity,
          'data-customer': customer
        }, linkGroup);
        
        // Create bezier curve path
        const controlPoint1X = source.x + (dest.x - source.x) / 3;
        const controlPoint2X = source.x + 2 * (dest.x - source.x) / 3;
        
        createSvgElement('path', {
          d: `M${source.x},${source.y} C${controlPoint1X},${source.y} ${controlPoint2X},${dest.y} ${dest.x},${dest.y}`,
          stroke: 'url(#linkGradient)',
          'stroke-width': thickness,
          fill: 'none',
          opacity: '0.7',
          filter: `drop-shadow(0 0 3px ${customerColor})`
        }, flowContainer);
        
        // Add quantity label
        const labelX = source.x + (dest.x - source.x) / 2;
        const labelY = source.y + (dest.y - source.y) / 2 - 10;
        
        createSvgElement('text', {
          x: labelX,
          y: labelY,
          'text-anchor': 'middle',
          'font-size': '14',
          'font-weight': 'bold',
          fill: 'white',
          textContent: allocation.quantity
        }, flowContainer);
      }
    });
    
    // Create legends
    createLegends(legendGroup, width, height, customerColors);
    
    // Append the SVG to the DOM
    svgRef.current.appendChild(svg);
  };
  
  // Helper function to create SVG elements with attributes
  const createSvgElement = (type, attributes, parent) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', type);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'textContent') {
        element.textContent = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    // Append to parent if provided
    if (parent) {
      parent.appendChild(element);
    }
    
    return element;
  };
  
  // Helper function to create gradients
  const createGradient = (defs, id, stops, isHorizontal = true) => {
    const gradient = createSvgElement('linearGradient', {
      id: id,
      x1: '0%',
      y1: '0%',
      x2: isHorizontal ? '100%' : '0%',
      y2: isHorizontal ? '0%' : '100%'
    }, defs);
    
    stops.forEach(stop => {
      createSvgElement('stop', {
        offset: stop.offset,
        'stop-color': stop.color
      }, gradient);
    });
    
    return gradient;
  };
  
  // Helper function to create legends
  const createLegends = (legendGroup, width, height, customerColors) => {
    // Source/Destination legend
    const nodeLegendBox = createSvgElement('rect', {
      x: 50,
      y: height - 110,
      width: 230,
      height: 90,
      rx: '5',
      ry: '5',
      fill: 'rgba(255,255,255,0.1)',
      stroke: '#6b7280'
    }, legendGroup);
    
    // Source legend item
    createSvgElement('path', {
      d: `M65,${height-85} L80,${height-95} L95,${height-85} L95,${height-65} L80,${height-55} L65,${height-65} Z`,
      fill: 'url(#sourceGradient)',
      stroke: '#818cf8',
      'stroke-width': '1'
    }, legendGroup);
    
    createSvgElement('text', {
      x: 105,
      y: height - 75,
      'font-size': '14',
      fill: 'white',
      textContent: 'Sources'
    }, legendGroup);
    
    // Destination legend item
    createSvgElement('path', {
      d: `M65,${height-45} L80,${height-55} L95,${height-45} L95,${height-25} L80,${height-15} L65,${height-25} Z`,
      fill: 'url(#destGradient)',
      stroke: '#34d399',
      'stroke-width': '1'
    }, legendGroup);
    
    createSvgElement('text', {
      x: 105,
      y: height - 35,
      'font-size': '14',
      fill: 'white',
      textContent: 'Destinations'
    }, legendGroup);
    
    // Flow line legend
    createSvgElement('line', {
      x1: 160,
      y1: height - 75,
      x2: 210,
      y2: height - 75,
      stroke: 'url(#linkGradient)',
      'stroke-width': '6'
    }, legendGroup);
    
    createSvgElement('text', {
      x: 220,
      y: height - 70,
      'font-size': '14',
      fill: 'white',
      textContent: 'Flow Volume'
    }, legendGroup);
    
    // Customer legend
    const customerLegendBox = createSvgElement('rect', {
      x: 300,
      y: height - 110,
      width: width - 350,
      height: 90,
      rx: '5',
      ry: '5',
      fill: 'rgba(255,255,255,0.1)',
      stroke: '#6b7280'
    }, legendGroup);
    
    // Add customer legend title
    createSvgElement('text', {
      x: 320,
      y: height - 85,
      'font-size': '14',
      'font-weight': 'bold',
      fill: 'white',
      textContent: 'Customers:'
    }, legendGroup);
    
    // Add customer color indicators
    const customerKeys = Object.keys(customerColors);
    const legendItemsPerRow = 3;
    const legendItemWidth = (width - 400) / legendItemsPerRow;
    
    customerKeys.forEach((customer, index) => {
      const row = Math.floor(index / legendItemsPerRow);
      const col = index % legendItemsPerRow;
      
      const xPos = 340 + (col * legendItemWidth);
      const yPos = height - 65 + (row * 25);
      
      createSvgElement('circle', {
        cx: xPos,
        cy: yPos,
        r: 6,
        fill: customerColors[customer].baseColor
      }, legendGroup);
      
      createSvgElement('text', {
        x: xPos + 12,
        y: yPos + 5,
        'font-size': '12',
        fill: 'white',
        textContent: customer
      }, legendGroup);
    });
  };
  
  return (
    <div className="w-full h-full">
      <div 
        ref={svgRef} 
        className="w-full h-full min-h-[600px] rounded-lg overflow-hidden"
      />
    </div>
  );
};

export default LogisticsFlowVisualization;