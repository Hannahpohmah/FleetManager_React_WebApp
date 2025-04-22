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

# Set proper encoding for stdout/stderr to handle Unicode characters
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

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

def safe_json_dumps(obj):
    """Safely encode JSON with proper handling of Unicode characters."""
    try:
        return json.dumps(obj, ensure_ascii=False)
    except UnicodeEncodeError:
        # Fallback to ASCII with escaping if needed
        return json.dumps(obj, ensure_ascii=True)

def find_route(data_file):
    """Find a route between two streets or multiple destinations from one source."""
    try:
        # Load data from the JSON file
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Loaded data file content: {safe_json_dumps(data)}", file=sys.stderr)
        
        # Check for different data formats
        if 'routes' in data:
            # Handle grouped routes format (from first error log)
            routes_data = data.get('routes', [])
            if not routes_data:
                return {"error": "No routes found in data file"}
            
            # Group routes by source
            source_groups = {}
            for route in routes_data:
                source = route.get('source')
                destination = route.get('destination')
                
                if not source or not destination:
                    return {"error": f"Missing source or destination in route: {route}"}
                
                if source not in source_groups:
                    source_groups[source] = []
                source_groups[source].append(destination)
            
            # Process each source group
            results = []
            for source, destinations in source_groups.items():
                print(f"Processing source '{source}' with destinations: {destinations}", file=sys.stderr)
                
                try:
                    # Call find_multi_stop_route which returns a single RouteResult
                    route = planner.find_multi_stop_route(source, destinations)
                    
                    # Clean street path of problematic Unicode characters
                    clean_street_path = [str(s).replace('\u2192', '->') for s in route.street_path]
                    
                    source_result = {
                        "source": source,
                        "destinations": destinations,
                        "distance": route.total_distance,
                        "time": route.total_time,
                        "streets": clean_street_path,
                        "traffic": serialize_traffic_distribution(route.traffic_distribution)
                    }
                    
                    results.append(source_result)
                    
                except ValueError as e:
                    # Handle errors for this source group
                    error_msg = str(e)
                    # Replace problematic Unicode characters
                    error_msg = error_msg.replace('\u2192', '->')
                    
                    results.append({
                        "source": source,
                        "error": error_msg,
                        "destinations": destinations
                    })
                except UnicodeEncodeError as e:
                    results.append({
                        "source": source,
                        "error": "Unicode encoding error in route data",
                        "destinations": destinations
                    })
            
            return {"results": results}
            
        else:
            # Handle original format (single source or multi-destination)
            source = data.get('source')
            if not source:
                return {"error": "Missing source in data file"}
            
            is_multi_destination = data.get('isMultiDestination', False)
            destinations = data.get('destinations', [])
            
            # If destinations array is present, treat as multi-destination
            if destinations and len(destinations) > 0:
                is_multi_destination = True
            elif not is_multi_destination:
                # Single destination case
                destination = data.get('destination')
                if not destination:
                    return {"error": "Missing destination in data file"}
                
                destinations = [destination]
            
            # Check if the input streets exist in network
            network_streets = list(network.street_to_nodes.keys())
            print(f"\nChecking if '{source}' exists in network:", file=sys.stderr)
            exact_match = source in network.street_to_nodes
            print(f"  Exact match: {exact_match}", file=sys.stderr)
            
            try:
                if is_multi_destination and len(destinations) > 1:
                    print(f"\nProcessing multi-destination request from '{source}' to {len(destinations)} destinations", file=sys.stderr)
                    
                    # Call find_multi_stop_route which returns a single RouteResult
                    route = planner.find_multi_stop_route(source, destinations)
                    
                    # Clean street path of problematic Unicode characters
                    clean_street_path = [str(s).replace('\u2192', '->') for s in route.street_path]
                    
                    result = {
                        "source": source,
                        "destinations": destinations,
                        "distance": route.total_distance,
                        "time": route.total_time,
                        "streets": clean_street_path,
                        "traffic": serialize_traffic_distribution(route.traffic_distribution)
                    }
                else:
                    print(f"\nProcessing single destination request from '{source}' to '{destinations[0]}'", file=sys.stderr)
                    # Use the standard find_route method for single destination
                    route = planner.find_route(source, destinations[0])
                    
                    # Clean street path of problematic Unicode characters
                    clean_street_path = [str(s).replace('\u2192', '->') for s in route.street_path]
                    
                    result = {
                        "source": source,
                        "destination": destinations[0],
                        "distance": route.total_distance,
                        "time": route.total_time,
                        "streets": clean_street_path,
                        "traffic": serialize_traffic_distribution(route.traffic_distribution)
                    }
                
                print("Route Result:", file=sys.stderr)
                print(safe_json_dumps(result), file=sys.stderr)
                return result
                
            except ValueError as e:
                # Handle the specific error from planner methods
                error_message = str(e)
                # Replace problematic Unicode characters
                error_message = error_message.replace('\u2192', '->')
                
                print(f"Planner reported error: {error_message}", file=sys.stderr)
                
                # Determine which street wasn't found for better error reporting
                search_term = source
                if "End street" in error_message:
                    for dest in destinations:
                        if dest in error_message:
                            search_term = dest
                            break
                
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
                print(safe_json_dumps(error_result), file=sys.stderr)
                return error_result
            
            except UnicodeEncodeError as e:
                error_result = {
                    "error": "Unicode encoding error in route data",
                    "details": str(e).replace('\u2192', '->')
                }
                print(safe_json_dumps(error_result), file=sys.stderr)
                return error_result
                
    except Exception as e:
        error_message = str(e)
        # Replace problematic Unicode characters
        error_message = error_message.replace('\u2192', '->')
        
        error_result = {
            "error": f"Unexpected error: {error_message}",
            "traceback": traceback.format_exc().replace('\u2192', '->')
        }
        print(safe_json_dumps(error_result), file=sys.stderr)
        return error_result

def optimize_transport(data_path):
    """Run the logistics optimization using the provided data."""
    try:
        print(f"Optimizing transport allocation from data: {data_path}", file=sys.stderr)
        with open(data_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Check which format we're dealing with
        if 'source' in data and 'destinations' in data:
            # Handle the new format with single source and multiple destinations
            source_data = [{"source_street": data["source"], "capacity": 100}]  # Default capacity
            destination_data = [{"dest_street": dest, "demand": 1} for dest in data["destinations"]]
            
            print(f"Data format converted: 1 source with {len(destination_data)} destinations", file=sys.stderr)
        elif 'sources' in data and 'destinations' in data:
            # Use existing format as-is
            source_data = data["sources"]
            destination_data = data["destinations"]
            print(f"Data loaded successfully: {len(source_data)} sources, {len(destination_data)} destinations", file=sys.stderr)
        else:
            raise KeyError("Invalid data format: missing required keys")
            
        sources = []
        for i, source in enumerate(source_data):
            try:
                sources.append(LogisticsRequest(source["source_street"], source["capacity"]))
                print(f"Added source {i+1}: {source['source_street']} with capacity {source['capacity']}", file=sys.stderr)
            except Exception as e:
                print(f"Error adding source {i+1}: {str(e)}", file=sys.stderr)
        
        destinations = []
        for i, dest in enumerate(destination_data):
            try:
                destinations.append(LogisticsDestination(dest["dest_street"], dest["demand"]))
                print(f"Added destination {i+1}: {dest['dest_street']} with demand {dest['demand']}", file=sys.stderr)
            except Exception as e:
                print(f"Error adding destination {i+1}: {str(e)}", file=sys.stderr)
        
        # Rest of the function remains the same...
        
        print(f"Starting optimization with {len(source_requests)} sources and {len(destination_requests)} destinations", file=sys.stderr)
        
        try:
            allocations = logistics_optimizer.optimize_transport_allocation(source_requests, destination_requests)
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
        print(f"Route Result: {safe_json_dumps(result)}", file=sys.stderr) 
        
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
        print(safe_json_dumps({"error": "Missing command argument"}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "find_route":
        # Check if data file is provided
        if len(sys.argv) < 3:
            print(safe_json_dumps({"error": "Missing data file path"}))
            sys.exit(1)
            
        data_path = sys.argv[2]
        result = find_route(data_path)
        print(safe_json_dumps(result))
            
    elif command == "find_routes":
        # Process routes from a file with multiple pairs
        if len(sys.argv) < 3:
            print(safe_json_dumps({"error": "Missing data path argument"}))
            sys.exit(1)
            
        data_path = sys.argv[2]
        try:
            with open(data_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            route_pairs = data.get('routePairs', [])
            
            if not route_pairs:
                print(safe_json_dumps({"error": "No route pairs found in data file"}))
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
                    
                try:
                    route = planner.find_route(source, destination)
                    # Clean street path of problematic Unicode characters
                    clean_street_path = [str(s).replace('\u2192', '->') for s in route.street_path]
                    
                    results.append({
                        "source": source,
                        "destination": destination,
                        "distance": route.total_distance,
                        "time": route.total_time,
                        "streets": clean_street_path,
                        "traffic": serialize_traffic_distribution(route.traffic_distribution)
                    })
                except ValueError as e:
                    error_msg = str(e).replace('\u2192', '->')
                    errors.append({
                        "source": source,
                        "destination": destination,
                        "error": error_msg
                    })
                except UnicodeEncodeError:
                    errors.append({
                        "source": source,
                        "destination": destination,
                        "error": "Unicode encoding error in route data"
                    })
                    
            print(safe_json_dumps({
                "routes": results,
                "errors": errors,
                "total": len(route_pairs),
                "success": len(results),
                "failed": len(errors)
            }))
            
        except Exception as e:
            error_msg = str(e).replace('\u2192', '->')
            print(safe_json_dumps({"error": f"Error processing routes: {error_msg}"}))
            sys.exit(1)
        
    elif command == "optimize":
        if len(sys.argv) < 3:
            print(safe_json_dumps({"error": "Missing data path argument"}))
            sys.exit(1)
            
        data_path = sys.argv[2]
        result = optimize_transport(data_path)
        print(safe_json_dumps(result))
        
    else:
        print(safe_json_dumps({"error": f"Unknown command: {command}"}))
        sys.exit(1)
