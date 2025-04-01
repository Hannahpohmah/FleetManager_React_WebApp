#!/usr/bin/env python
# Save as python_scripts/app.py
import traceback
import sys
import json
import os
import pickle
import re
from models import (TransportNetwork, ImprovedRLAgent, 
                    ImprovedRoutePlanner, LogisticsOptimizer, TrafficState)

print("Python script started", file=sys.stderr)
print(f"Current working directory: {os.getcwd()}", file=sys.stderr)
print(f"Args received: {sys.argv}", file=sys.stderr)

# Get the script directory and parent directory
script_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(script_dir)  # Go up one level to the backend root

# Debug: Check file paths
pickle_files = {
    'saved_route_planner.pkl': os.path.join(parent_dir, 'saved_route_planner.pkl'),
    'saved_logistics_optimizer.pkl': os.path.join(parent_dir, 'saved_logistics_optimizer.pkl'),
    'saved_network_updated.pkl': os.path.join(parent_dir, 'saved_network_updated.pkl')
}

print(f"Looking for pickle files:", file=sys.stderr)
for name, path in pickle_files.items():
    print(f"  {name}: {path} - {'EXISTS' if os.path.exists(path) else 'MISSING'}", file=sys.stderr)

# Load the saved pickle files
try:
    with open(pickle_files['saved_route_planner.pkl'], 'rb') as f:
        planner = pickle.load(f)
    with open(pickle_files['saved_logistics_optimizer.pkl'], 'rb') as f:
        logistics_optimizer = pickle.load(f)
    with open(pickle_files['saved_network_updated.pkl'], 'rb') as f:
        network = pickle.load(f)
    
    print("All components loaded successfully!", file=sys.stderr)
except Exception as e:
    print(f"Error loading components: {str(e)}", file=sys.stderr)
    sys.exit(1)

# Rest of your code remains the same

# Data classes for logistics
class LogisticsDestination:
    def __init__(self, dest_street, demand):
        self.dest_street = dest_street
        self.demand = demand

class LogisticsRequest:
    def __init__(self, source_street, capacity):
        self.source_street = source_street
        self.capacity = capacity

def serialize_traffic_distribution(traffic_dist):
    """Convert traffic distribution to serializable format."""
    return {str(key): value for key, value in traffic_dist.items()}


def find_route(start, end):
    """Find a route between two streets with detailed diagnostics."""
    try:
        
        network_streets = list(network.street_to_nodes.keys())
        # Check if the input streets exist in network (with detailed diagnostics)
        print(f"\nChecking if '{start}' exists in network:", file=sys.stderr)
        exact_match = start in network.street_to_nodes
        print(f"  Exact match: {exact_match}", file=sys.stderr)
        
        print(f"\nChecking if '{end}' exists in network:", file=sys.stderr)
        exact_match_end = end in network.street_to_nodes
        print(f"  Exact match: {exact_match_end}", file=sys.stderr)
        
        # Attempt to find route using the planner's own lookup logic
        print(f"\nAttempting to find route from '{start}' to '{end}'", file=sys.stderr)
        
        # IMPORTANT CHANGE: Use the raw street names and let the planner handle the lookups
        # This will use the same lookup logic as in the ImprovedRoutePlanner class
        try:
            route = planner.find_route(start, end)
            result = {
                "distance": route.total_distance,
                "time": route.total_time,
                "streets": route.street_path,
                "traffic": serialize_traffic_distribution(route.traffic_distribution)
            }
            print("Route Result:", file=sys.stderr)
            print(json.dumps(result), file=sys.stderr)
            return result
        except ValueError as e:
            # Handle the specific error from planner.find_route
            error_message = str(e)
            print(f"Planner reported error: {error_message}", file=sys.stderr)
            
            # Determine which street wasn't found
            search_term = start
            if "End street" in error_message:
                search_term = end
            
            # Find similar streets for helpful error message
            similar_streets = []
            for network_street in network_streets:
                if search_term.lower() in network_street.lower() or network_street.lower() in search_term.lower():
                    similar_streets.append(network_street)
                    if len(similar_streets) >= 5:
                        break
            
            error_result = {
                "error": error_message,
                "similar_streets": similar_streets
            }
            print(json.dumps(error_result), file=sys.stderr)
            return error_result
            
    except Exception as e:
        error_result = {
            "error": f"Unexpected error: {str(e)}",
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_result))
        return error_result


def optimize_transport(data_path):
    """Run the logistics optimization using the provided data."""
    try:
        print(f"Optimizing transport allocation from data: {data_path}", file=sys.stderr)
        with open(data_path, 'r') as f:
            data = json.load(f)
        
        print(f"Data loaded successfully: {len(data['sources'])} sources, {len(data['destinations'])} destinations", file=sys.stderr)
        
        sources = []
        for i, source in enumerate(data["sources"]):
            try:
                sources.append(LogisticsRequest(source["source_street"], source["capacity"]))
                print(f"Added source {i+1}: {source['source_street']} with capacity {source['capacity']}", file=sys.stderr)
            except Exception as e:
                print(f"Error adding source {i+1}: {str(e)}", file=sys.stderr)
        
        destinations = []
        for i, dest in enumerate(data["destinations"]):
            try:
                destinations.append(LogisticsDestination(dest["dest_street"], dest["demand"]))
                print(f"Added destination {i+1}: {dest['dest_street']} with demand {dest['demand']}", file=sys.stderr)
            except Exception as e:
                print(f"Error adding destination {i+1}: {str(e)}", file=sys.stderr)
        
        print(f"Starting optimization with {len(sources)} sources and {len(destinations)} destinations", file=sys.stderr)
        
        try:
            allocations = logistics_optimizer.optimize_transport_allocation(sources, destinations)
            print(f"Optimization complete, generated {len(allocations)} allocations", file=sys.stderr)
        except Exception as e:
            print(f"Error during optimization process: {str(e)}", file=sys.stderr)
            return {"error": f"Optimization process error: {str(e)}", "allocations": []}
        
        # Convert allocations to serializable format
        allocation_results = []
        for alloc in allocations:
            allocation_results.append({
                "source": alloc.source_street,
                "destination": alloc.dest_street,
                "quantity": alloc.quantity
            })
      
        result = {"allocations": allocation_results}
        print(json.dumps(result),file=sys.stderr) 
        
        return result
            
        
    except Exception as e:
        traceback_info = traceback.format_exc()
        print(f"Optimization error: {str(e)}", file=sys.stderr)
        print(f"Traceback: {traceback_info}", file=sys.stderr)
        return {
            "error": f"Optimization error: {str(e)}",
            "traceback": traceback_info,
            "allocations": []
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing command argument"}), file=sys.stderr)
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "find_route":
        # Check if arguments are passed directly or via file
        if len(sys.argv) >= 4:
            # Direct arguments mode
            start = sys.argv[2]
            end = sys.argv[3]
            result = find_route(start, end)
            print(json.dumps(result), file=sys.stderr)
        elif len(sys.argv) == 3:
            # File mode - read from JSON file
            data_path = sys.argv[2]
            try:
                with open(data_path, 'r') as f:
                    data = json.load(f)
                    
                start = data.get('source')
                end = data.get('destination')
                
                if not start or not end:
                    print(json.dumps({"error": "Missing source or destination in data file"}), file=sys.stderr)
                    sys.exit(1)
                    
                result = find_route(start, end)
                print(json.dumps(result), file=sys.stderr)
            except Exception as e:
                print(json.dumps({"error": f"Error reading data file: {str(e)}"}), file=sys.stderr)
                sys.exit(1)
        else:
            print(json.dumps({"error": "Missing start/end streets or data file path"}), file=sys.stderr)
            sys.exit(1)
            
    elif command == "find_routes":
        # Process routes from a file with multiple pairs
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing data path argument"}), file=sys.stderr)
            sys.exit(1)
            
        data_path = sys.argv[2]
        try:
            with open(data_path, 'r') as f:
                data = json.load(f)
                
            route_pairs = data.get('routePairs', [])
            
            if not route_pairs:
                print(json.dumps({"error": "No route pairs found in data file"}), file=sys.stderr)
                sys.exit(1)
                
            results = []
            errors = []
            
            for pair in route_pairs:
                source = pair.get('source')
                destination = pair.get('destination')
                
                if not source or not destination:
                    errors.append({
                        "source": source or "unknown",
                        "destination": destination or "unknown",
                        "error": "Missing source or destination"
                    })
                    continue
                    
                result = find_route(source, destination)
                
                if "error" in result:
                    errors.append({
                        "source": source,
                        "destination": destination,
                        **result
                    })
                else:
                    results.append({
                        "source": source,
                        "destination": destination,
                        **result
                    })
                    
            print(json.dumps({
                "routes": results,
                "errors": errors,
                "total": len(route_pairs),
                "success": len(results),
                "failed": len(errors)
            }), file=sys.stderr)
            
        except Exception as e:
            print(json.dumps({"error": f"Error processing routes: {str(e)}"}), file=sys.stderr)
            sys.exit(1)
        
    elif command == "optimize":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing data path argument"}), file=sys.stderr)
            sys.exit(1)
            
        data_path = sys.argv[2]
        result = optimize_transport(data_path)
        print(json.dumps(result), file=sys.stderr)
        
    else:
        print(json.dumps({"error": f"Unknown command: {command}"}), file=sys.stderr)
        sys.exit(1)