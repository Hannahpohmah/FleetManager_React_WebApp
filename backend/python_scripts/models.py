# ----------------------- RLAgent -----------------------
from collections import defaultdict
import random
import numpy as np
from typing import List,Optional,Dict,Tuple,Set
from enum import IntEnum
from dataclasses import dataclass
import xml.etree.ElementTree as ET
import pandas as pd
import networkx as nx
import sys
import re
import concurrent.futures
from collections import deque
import time
import random

class TrafficState(IntEnum):
    LIGHT = 0
    MODERATE = 1
    HEAVY = 2
    SEVERE = 3

@dataclass
class RouteSegment:
    from_node: str
    to_node: str
    street_name: str
    length: float
    traffic_state: TrafficState
    estimated_time: float

@dataclass
class RouteResult:
    path: List[str]
    street_path: List[str]
    total_distance: float
    total_time: float
    success: bool
    traffic_distribution: dict
    segments: List[RouteSegment]

class ImprovedRLAgent:
    @staticmethod
    def default_dict_float():
        return defaultdict(float)

    def __init__(self, learning_rate: float = 0.1,
                 discount_factor: float = 0.9,
                 epsilon: float = 1.0,
                 epsilon_decay: float = 0.995,
                 epsilon_min: float = 0.01):
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.epsilon_min = epsilon_min
        # Use the static method from the class to initialize the q_table
        self.q_table = defaultdict(ImprovedRLAgent.default_dict_float)
        self.replay_buffer = []
        self.buffer_size = 1000
        self.batch_size = 32

    def store_experience(self, state, action, reward, next_state, next_actions):
        """Store experience in replay buffer"""
        self.replay_buffer.append((state, action, reward, next_state, next_actions))
        if len(self.replay_buffer) > self.buffer_size:
            self.replay_buffer.pop(0)

    def experience_replay(self, batch_size=None, experience_buffer=None):
        """Learn from stored experiences with optional custom batch size and buffer"""
        if batch_size is None:
            batch_size = self.batch_size
            
        buffer = experience_buffer if experience_buffer is not None else self.replay_buffer

        if len(buffer) < batch_size:
            return

        batch = random.sample(buffer, batch_size)
        for state, action, reward, next_state, next_actions in batch:
            self.update(state, action, reward, next_state, next_actions)

    def choose_action(self, state, available_actions, is_training=True, temperature=1.0):
        """Choose action with numerical stability improvements"""
        if not available_actions:
            raise ValueError("No available actions to choose from")

        # Exploration phase
        if is_training and random.random() < self.epsilon:
            return random.choice(available_actions)

        # Exploitation phase with numerical stability improvements
        q_values = np.array([self.get_q_value(state, action) for action in available_actions])

        # Apply numerical stability techniques
        if len(q_values) > 0:
            # Subtract max value for numerical stability (standard technique)
            max_q = np.max(q_values)
            shifted_q = q_values - max_q

            # Use stable calculation and catch any potential issues
            try:
                # Clip to prevent overflow
                clipped_q = np.clip(shifted_q / temperature, -20, 20)
                exp_q = np.exp(clipped_q)
                sum_exp_q = np.sum(exp_q)

                # Check for zero division
                if sum_exp_q > 0:
                    probs = exp_q / sum_exp_q
                else:
                    # If all values underflow, use uniform distribution
                    probs = np.ones(len(available_actions)) / len(available_actions)

                # Validate probabilities
                if np.isnan(probs).any() or np.isinf(probs).any():
                    # Fall back to greedy selection
                    return available_actions[np.argmax(q_values)]

                # Choose based on probability distribution
                return np.random.choice(available_actions, p=probs)

            except Exception as e:
                print(f"Error in probability calculation: {str(e)}")
                # Fall back to greedy selection
                return available_actions[np.argmax(q_values)]
        else:
            return random.choice(available_actions)

    def update(self, state, action, reward, next_state, next_actions):
        """Update Q-values with clipping to prevent numerical issues"""
        if not next_actions:
            next_q_value = 0
        else:
            next_q_values = [self.get_q_value(next_state, a) for a in next_actions]
            next_q_value = max(next_q_values) if next_q_values else 0

        # Get current Q value
        current_q = self.get_q_value(state, action)

        # Update rule with clipping
        new_q = current_q + self.learning_rate * (reward + self.discount_factor * next_q_value - current_q)

        # Clip Q-values to prevent them from growing too large
        new_q = np.clip(new_q, -1000, 1000)

        # Store in Q-table
        self.q_table[state][action] = new_q
    def get_q_value(self, state, action):
        """Get Q-value for a state-action pair"""
        return self.q_table[state][action]
    
# ----------------------- TransportNetwork -----------------------
import xml.etree.ElementTree as ET
class TransportNetwork:
    def __init__(self):
        self.graph = nx.DiGraph()
        self.street_to_nodes = defaultdict(list)
        self.node_to_street = {}
        self.bottleneck_nodes = set()

    def load_network(self, osm_file: str) -> None:
        try:
            tree = ET.parse(osm_file)
            root = tree.getroot()
        except ET.ParseError as e:
            raise ValueError(f"Invalid OSM file format: {str(e)}")
        except FileNotFoundError:
            raise FileNotFoundError(f"OSM file not found: {osm_file}")

        for edge in root.findall('.//edge'):
            self._process_edge(edge)

        if self.graph.number_of_nodes() == 0:
            raise ValueError("No valid edges found in the OSM file")

        # Ensure network connectivity
        largest_cc = max(nx.weakly_connected_components(self.graph), key=len)
        self.graph = self.graph.subgraph(largest_cc).copy()

        # Preprocess network for RL
        self.preprocess_network_for_rl()

    def _process_edge(self, edge: ET.Element) -> None:
        edge_id = edge.get('id')
        from_node = edge.get('from')
        to_node = edge.get('to')
        name = edge.get('name', f"Street_{edge_id}")

        if not all([edge_id, from_node, to_node]):
            return

        # Default values if attributes are missing
        speed = 13.89  # 50 km/h in m/s
        length = 100.0  # 100 meters

        lanes = edge.findall('.//lane')
        if lanes:
            speed = float(lanes[0].get('speed', speed))
            length = float(lanes[0].get('length', length))

        self.graph.add_edge(
            from_node,
            to_node,
            edge_id=edge_id,
            street_name=name,
            speed_limit=speed,
            length=length,
            traffic_state=TrafficState.LIGHT
        )

        self.street_to_nodes[name].append((from_node, to_node))
        self.node_to_street[from_node] = name
        self.node_to_street[to_node] = name

    def update_traffic(self, traffic_data: pd.DataFrame) -> None:
        # Create a mapping of edge_ids to their corresponding graph edges for faster lookup
        edge_id_map = {}
        for u, v, d in self.graph.edges(data=True):
            edge_id = d.get('edge_id')
            if edge_id:
                if edge_id not in edge_id_map:
                    edge_id_map[edge_id] = []
                edge_id_map[edge_id].append((u, v))

        # Update traffic states for all rows in one pass
        for _, row in traffic_data.iterrows():
            edge_id = row['edge_id']
            if edge_id in edge_id_map:
                traffic_state = self._calculate_traffic_state(
                    row.get('mean_speed'),
                    row.get('occupancy'),
                    row.get('vehicle_count')
                )

                # Update all edges with this edge_id
                for u, v in edge_id_map[edge_id]:
                    self.graph[u][v]['traffic_state'] = traffic_state

    def _calculate_traffic_state(self, speed: Optional[float],
                               occupancy: Optional[float],
                               vehicle_count: Optional[float]) -> TrafficState:
        speed_factor = 1 / (speed + 1) if speed is not None else 1.0
        occupancy_factor = occupancy / 100 if occupancy is not None else 0.0
        count_factor = min(1, vehicle_count / 10) if vehicle_count is not None else 0.0

        traffic_score = (0.4 * speed_factor +
                        0.4 * occupancy_factor +
                        0.2 * count_factor)

        if traffic_score <= 0.3:
            return TrafficState.LIGHT
        elif traffic_score <= 0.6:
            return TrafficState.MODERATE
        elif traffic_score <= 0.8:
            return TrafficState.HEAVY
        else:
            return TrafficState.SEVERE

    def preprocess_network_for_rl(self):
        """Prepare network for more efficient RL training"""
        # Add node degree information to state representation
        for node in self.graph.nodes():
            in_degree = self.graph.in_degree(node)
            out_degree = self.graph.out_degree(node)
            self.graph.nodes[node]['connectivity'] = in_degree + out_degree

        # Identify bottleneck nodes (important junction points)
        bottlenecks = []
        for node in self.graph.nodes():
            if self.graph.nodes[node]['connectivity'] > 3:  # More than 3 connections
                bottlenecks.append(node)

        # Store this information for state representation
        self.bottleneck_nodes = set(bottlenecks)

        # Print network statistics
        print(f"Network has {self.graph.number_of_nodes()} nodes and {self.graph.number_of_edges()} edges")
        print(f"Identified {len(bottlenecks)} bottleneck nodes")
        print(f"Network has {len(self.street_to_nodes)} unique streets")

# ----------------------- RoutePlanner -----------------------
class ImprovedRoutePlanner:
    def __init__(self, network: TransportNetwork, agent: ImprovedRLAgent):
        self.network = network
        self.agent = agent
        self.shortest_path_cache = {}  # Cache for shortest paths
        self.state_cache = {}  # Cache for states
        self.connectivity_cache = {}  # Cache for connectivity checks
        self.distance_cache = {}  # Cache for distance calculations

    def _get_street_nodes(self, street: str) -> Set[str]:
        """Get all nodes associated with a street."""
        nodes = set()
        for from_node, to_node in self.network.street_to_nodes[street]:
            nodes.add(from_node)
            nodes.add(to_node)
        return nodes

    def _get_state(self, node: str) -> str:
        # Replace string concatenation with more efficient representation
        edges = list(self.network.graph.edges(node, data=True))
        connectivity = self.network.graph.nodes[node].get('connectivity', 0)

        if not edges:
            return f"{node}|c{connectivity}|t0.0|b{1 if node in self.network.bottleneck_nodes else 0}|"

        # Use array operations instead of list comprehensions
        traffic_sum = 0
        traffic_conditions = []
        for _, dest, data in edges:
            traffic_sum += data['traffic_state'].value
            traffic_conditions.append(f"{dest}:{data['traffic_state'].value}")

        avg_traffic = traffic_sum / len(edges)
        is_bottleneck = 1 if node in self.network.bottleneck_nodes else 0

        # Join once at the end
        return f"{node}|c{connectivity}|t{avg_traffic:.1f}|b{is_bottleneck}|{'_'.join(sorted(traffic_conditions))}"

    def _calculate_reward(self, current: str, next_node: str) -> float:
        """Calculate reward for moving from current to next_node."""
        edge = self.network.graph[current][next_node]
        traffic_multiplier = 1 + (edge['traffic_state'].value * 0.25)
        time_cost = edge['length'] / edge['speed_limit'] * traffic_multiplier
        return -time_cost  # Negative because we want to minimize time

    def _create_route_result(self, path: List[str]) -> RouteResult:
        """Create a RouteResult object from a path with validation."""

        if len(path) <= 1:
            return RouteResult(
                path=path,
                street_path=[],
                total_distance=0,
                total_time=0,
                success=False,
                traffic_distribution={},
                segments=[]
            )

        segments = []
        total_distance = 0
        total_time = 0
        # Initialize counters for all possible traffic states (assuming TrafficState is an Enum)
        traffic_counts = {state: 0 for state in TrafficState}
        street_path = []

        # Validate path connectivity
        for i in range(len(path) - 1):
            current = path[i]
            next_node = path[i + 1]

            if not self.network.graph.has_edge(current, next_node):
                return RouteResult(
                    path=path,
                    street_path=[],
                    total_distance=0,
                    total_time=0,
                    success=False,
                    traffic_distribution={},
                    segments=[]
                )

            edge = self.network.graph[current][next_node]
            time = (edge['length'] / edge['speed_limit'] *
                  (1 + edge['traffic_state'].value * 0.25))

            segment = RouteSegment(
                from_node=current,
                to_node=next_node,
                street_name=edge['street_name'],
                length=edge['length'],
                traffic_state=edge['traffic_state'],
                estimated_time=time
            )

            segments.append(segment)
            total_distance += edge['length']
            total_time += time
            # Count by segment length instead of just incrementing
            traffic_counts[edge['traffic_state']] += edge['length']

            if not street_path or street_path[-1] != edge['street_name']:
                street_path.append(edge['street_name'])
        
        # Find and add the end destination street name
        end_node = path[-1]
        
        # Improved method to find the end street
        # First check if we already have a segment with the end node as destination
        if segments and segments[-1].to_node == end_node:
            end_street = segments[-1].street_name
        else:
            # Fallback method: search for the street by end node
            end_street = None
            
            # Find streets containing the end node
            for street, nodes in self.network.street_to_nodes.items():
                for node_info in nodes:
                    # Check if this is the correct format for node_info
                    if isinstance(node_info, tuple) and node_info[0] == end_node:
                        end_street = street
                        break
                    elif node_info == end_node:  # Alternative format check
                        end_street = street
                        break
                if end_street:
                    break
        
        # Explicitly add the end street to the path if it's not already there
        if end_street and (not street_path or street_path[-1] != end_street):
            street_path.append(end_street)

        if total_distance > 0:
            # Calculate distribution based on distance, not segment count
            traffic_distribution = {
                state: (distance / total_distance * 100)
                for state, distance in traffic_counts.items()
            }
        else:
            traffic_distribution = {state: 0 for state in TrafficState}

        return RouteResult(
            path=path,
            street_path=street_path,
            total_distance=total_distance,
            total_time=total_time,
            success=True,
            traffic_distribution=traffic_distribution,
            segments=segments
        )
    def find_route(self, start_street: str, end_street: str,
           min_episodes: int = 1000,
           max_episodes: int = 3000,
           success_threshold: float = 0.7) -> RouteResult:
        """Find optimal route between two streets using enhanced RL approach with performance optimizations."""
        start_time = time.time()
        print(f"Finding route from {start_street} to {end_street}")

        # Validate input streets
        if start_street not in self.network.street_to_nodes:
            raise ValueError(f"Start street '{start_street}' not found in network")
        if end_street not in self.network.street_to_nodes:
            raise ValueError(f"End street '{end_street}' not found in network")

        # Handle case when streets are the same
        if start_street == end_street:
            print(f"Start and end streets are the same, returning direct path")
            start_node, end_node = self.network.street_to_nodes[start_street][0]
            return self._create_route_result([start_node, end_node])

        # Get all nodes for each street
        start_nodes = self._get_street_nodes(start_street)
        end_nodes = self._get_street_nodes(end_street)

        print(f"Finding route from {start_street} ({len(start_nodes)} nodes) to {end_street} ({len(end_nodes)} nodes)")

        # Check if path exists using bidirectional search
        if (start_street, end_street) in self.connectivity_cache:
            path_exists = self.connectivity_cache[(start_street, end_street)]
            print(f"Using cached connectivity info: {'connected' if path_exists else 'not connected'}")
        else:
            path_exists = self._check_connectivity(start_nodes, end_nodes)
            self.connectivity_cache[(start_street, end_street)] = path_exists

        if not path_exists:
            raise ValueError(f"No valid path exists between {start_street} and {end_street}")

        # For large networks, select most promising nodes using connectivity and centrality
        if len(start_nodes) > 5 or len(end_nodes) > 5:
            start_nodes, end_nodes = self._select_promising_nodes(start_nodes, end_nodes)
            print(f"Selected {len(start_nodes)} start nodes and {len(end_nodes)} end nodes for exploration")

        # Dynamically adjust episode counts based on network complexity
        network_size_factor = min(1.0, 50000 / len(self.network.graph))  # Scale down for larger networks
        distance_factor = 1.0  # Will be updated if we can estimate distance

        # Try to estimate distance between streets to adjust episode count
        if len(start_nodes) > 0 and len(end_nodes) > 0:
            try:
                # Find a sample path to gauge distance
                sample_start = next(iter(start_nodes))
                sample_end = next(iter(end_nodes))
                sample_path = nx.shortest_path(self.network.graph, sample_start, sample_end)
                path_length = len(sample_path)

                # Adjust factors based on path complexity
                distance_factor = min(1.0, 100 / path_length)  # Scale down for longer paths
                print(f"Estimated path length: {path_length} nodes")
            except:
                print("Could not estimate path length")

        # Adjust episode counts
        adjusted_min_episodes = int(min_episodes * network_size_factor * distance_factor)
        adjusted_max_episodes = int(max_episodes * network_size_factor * distance_factor)

        # Ensure minimums
        adjusted_min_episodes = max(100, adjusted_min_episodes)
        adjusted_max_episodes = max(adjusted_min_episodes + 500, adjusted_max_episodes)

        print(f"Adjusted episode range: {adjusted_min_episodes} to {adjusted_max_episodes}")

        # Try multiple node pairs with intelligent selection
        best_route = None
        best_reward = float('-inf')
        attempts = 0
        max_attempts = min(9, len(start_nodes) * len(end_nodes))  # Limit number of attempts

        # Create a prioritized list of node pairs to try
        node_pairs = []

        for start_node in start_nodes:
            for end_node in end_nodes:
                if start_node == end_node:
                    continue

                # Calculate priority based on connectivity and distance (if available)
                start_connectivity = self.network.graph.nodes[start_node].get('connectivity', 0)
                end_connectivity = self.network.graph.nodes[end_node].get('connectivity', 0)

                # Try to get distance between nodes
                try:
                    distance = nx.shortest_path_length(self.network.graph, start_node, end_node)
                    # Prioritize shorter distances and higher connectivity
                    priority = (start_connectivity + end_connectivity) / (distance + 1)
                except:
                    # If distance can't be calculated, just use connectivity
                    priority = start_connectivity + end_connectivity

                node_pairs.append((start_node, end_node, priority))

        # Sort by priority (highest first)
        node_pairs.sort(key=lambda x: x[2], reverse=True)

        # Take top N pairs
        top_pairs = node_pairs[:max_attempts]
        print(f"Will try {len(top_pairs)} node pairs, prioritized by connectivity and distance")

        # Track overall progress
        successful_attempts = 0
        total_episodes = 0

        # Try each pair
        for start_node, end_node, priority in top_pairs:
            attempts += 1
            print(f"\nAttempt {attempts}/{len(top_pairs)}: Route from node {start_node} to {end_node} (priority: {priority:.2f})")

            # Early exit if we've already found a good route and tried enough pairs
            if best_route and successful_attempts >= 2 and attempts >= 3:
                print(f"Already found {successful_attempts} successful routes, stopping further attempts")
                break

            # Adjust episode count dynamically based on progress
            if successful_attempts > 0:
                # Reduce episodes for later attempts if we already have successful routes
                current_min_episodes = adjusted_min_episodes // 2
                current_max_episodes = adjusted_max_episodes // 2
            else:
                current_min_episodes = adjusted_min_episodes
                current_max_episodes = adjusted_max_episodes

            # Further reduce for low-priority pairs
            if attempts > 2:
                current_min_episodes = current_min_episodes // 2
                current_max_episodes = current_max_episodes // 2

            # Find route for this pair
            route = self._improved_train_route(
                start_node, end_node,
                current_min_episodes,
                current_max_episodes,
                success_threshold
            )

            if route and route.success:
                successful_attempts += 1
                reward = -route.total_time
                print(f"Found route with time {route.total_time:.1f}s, distance {route.total_distance:.0f}m")

                if reward > best_reward:
                    best_route = route
                    best_reward = reward
                    print(f"New best route found!")

                    # If this route is particularly good, consider stopping early
                    if route.total_distance < 1.3 * nx.shortest_path_length(
                        self.network.graph, start_node, end_node, weight='length'):
                        print("Found route very close to shortest path, stopping")
                        break

        # Check if we found a valid route
        if not best_route:
            if successful_attempts > 0:
                # If we had successful attempts but no best route, there's a logic error
                raise ValueError("Logic error: Had successful attempts but no best route")
            raise ValueError(f"No valid route found between {start_street} and {end_street}")

        # Ensure the end street is added to the route's street path
        if best_route.street_path and best_route.street_path[-1] != end_street:
            best_route.street_path.append(end_street)

        # Report total time
        elapsed = time.time() - start_time
        print(f"Route finding completed in {elapsed:.2f} seconds")
        print(f"Final route: {len(best_route.path)} nodes, {best_route.total_distance:.0f}m, {best_route.total_time:.1f}s")

        return best_route
    def find_multi_stop_route(self, start_street: str, destination_streets: List[str],
                  min_episodes: int = 1000, max_episodes: int = 3000,
                      success_threshold: float = 0.7) -> RouteResult:
        """
        Find a route from start_street through all destination_streets in the optimal order,
        with improved logic to avoid revisiting streets when possible.

        Args:
            start_street: Starting street
            destination_streets: List of destination streets to visit in any order
            min_episodes: Minimum number of training episodes per segment
            max_episodes: Maximum number of training episodes per segment
            success_threshold: Success rate threshold for early stopping

        Returns:
            RouteResult object representing the complete route
        """
        if not destination_streets:
            raise ValueError("At least one destination street must be provided")

        start_time = time.time()
        print(f"Finding optimal multi-stop route from {start_street} through {len(destination_streets)} destinations")

        # Validate all streets exist
        for street in [start_street] + destination_streets:
            if street not in self.network.street_to_nodes:
                raise ValueError(f"Street '{street}' not found in network")

        # Compute distances between all pairs of streets (including start)
        all_streets = [start_street] + destination_streets
        distance_matrix = {}

        print("Computing distances between all street pairs...")
        for i, street1 in enumerate(all_streets):
            distance_matrix[street1] = {}
            for j, street2 in enumerate(all_streets):
                if i == j:
                    distance_matrix[street1][street2] = 0
                    continue

                # Skip redundant calculations
                if street2 in distance_matrix and street1 in distance_matrix[street2]:
                    distance_matrix[street1][street2] = distance_matrix[street2][street1]
                    continue

                # Estimate distance between streets
                try:
                    # Use the first node of each street for estimation
                    start_nodes = self._get_street_nodes(street1)
                    end_nodes = self._get_street_nodes(street2)

                    # Find the shortest path between any pair of nodes
                    min_distance = float('inf')
                    for start_node in list(start_nodes)[:3]:  # Limit to 3 nodes for efficiency
                        for end_node in list(end_nodes)[:3]:
                            try:
                                path_length = nx.shortest_path_length(
                                    self.network.graph, start_node, end_node, weight='length')
                                min_distance = min(min_distance, path_length)
                            except:
                                continue

                    if min_distance == float('inf'):
                        # Fallback to topological distance if length-based fails
                        for start_node in list(start_nodes)[:3]:
                            for end_node in list(end_nodes)[:3]:
                                try:
                                    path_length = len(nx.shortest_path(self.network.graph, start_node, end_node))
                                    min_distance = min(min_distance, path_length * 100)  # Rough estimate
                                except:
                                    continue

                    if min_distance == float('inf'):
                        print(f"Warning: Could not find distance between {street1} and {street2}")
                        min_distance = 10000  # Some large default value

                    distance_matrix[street1][street2] = min_distance
                except Exception as e:
                    print(f"Error estimating distance between {street1} and {street2}: {str(e)}")
                    distance_matrix[street1][street2] = 10000  # Default large value

        # Find optimal order using nearest neighbor heuristic
        current_street = start_street
        unvisited = set(destination_streets)
        optimal_order = [current_street]

        while unvisited:
            # Find nearest unvisited street
            next_street = min(unvisited,
                              key=lambda s: distance_matrix[current_street][s])
            optimal_order.append(next_street)
            unvisited.remove(next_street)
            current_street = next_street

        print(f"Optimal visiting order: {' → '.join(optimal_order)}")

        # Create route segments between consecutive stops in the optimal order
        current_street = start_street
        segment_routes = []
        visited_streets = set()  # Track streets we've already visited
        visited_edges = set()    # Track edges we've already traversed
        
        # Track which destination streets have been officially visited as stops
        visited_destination_streets = set()
        remaining_destination_streets = set(destination_streets)

        for i, next_street in enumerate(optimal_order[1:]):
            print(f"\n==== Finding route segment {i+1}/{len(optimal_order)-1}: {current_street} → {next_street} ====")

            # Handle case when consecutive streets are the same
            if current_street == next_street:
                print(f"Current and next streets are the same, skipping segment")
                # Create a minimal route result for the same street
                start_node, end_node = self.network.street_to_nodes[current_street][0]
                segment = self._create_route_result([start_node, end_node])
                segment_routes.append(segment)
                
                # Mark current destination as visited and remove from remaining
                visited_destination_streets.add(next_street)
                if next_street in remaining_destination_streets:
                    remaining_destination_streets.remove(next_street)
            else:
                # Find route for this segment with penalty for revisited streets
                try:
                    # Scale down episodes for intermediate segments to improve overall performance
                    segment_min_episodes = min_episodes
                    segment_max_episodes = max_episodes

                    # For very long multi-stop routes, scale down episodes for middle segments
                    if len(optimal_order) > 4 and 0 < i < len(optimal_order) - 2:
                        segment_min_episodes = int(min_episodes * 0.7)
                        segment_max_episodes = int(max_episodes * 0.7)

                    # Create a temporary modified graph with penalties for revisited streets
                    if visited_streets and i > 0:
                        # Print the streets being penalized for clarity
                        print(f"Penalized streets: {', '.join(sorted(visited_streets))}")
                        
                        # Create a modified graph with penalties that exempt remaining destinations
                        modified_graph = self._create_modified_graph_with_penalties(
                            visited_streets, 
                            visited_edges,
                            remaining_destination_streets  # Pass remaining destinations to exempt them
                        )

                        # Temporarily swap the graphs
                        original_graph = self.network.graph
                        self.network.graph = modified_graph

                        print(f"Applied penalties to {len(visited_streets)} previously visited streets, exempting {len(remaining_destination_streets)} remaining destinations")

                        try:
                            segment = self.find_route(
                                current_street, next_street,
                                min_episodes=segment_min_episodes,
                                max_episodes=segment_max_episodes,
                                success_threshold=success_threshold
                            )
                        finally:
                            # Restore original graph
                            self.network.graph = original_graph
                    else:
                        # First segment, use original graph
                        segment = self.find_route(
                            current_street, next_street,
                            min_episodes=segment_min_episodes,
                            max_episodes=segment_max_episodes,
                            success_threshold=success_threshold
                        )

                    # Update visited streets and edges
                    if segment.success:
                        # Add all streets in this segment to visited streets
                        visited_streets.update(segment.street_path)

                        # Add all edges in this segment to visited edges
                        for seg in segment.segments:
                            visited_edges.add((seg.from_node, seg.to_node))
                        
                        # Mark current destination as visited and remove from remaining
                        visited_destination_streets.add(next_street)
                        if next_street in remaining_destination_streets:
                            remaining_destination_streets.remove(next_street)

                        segment_routes.append(segment)
                    else:
                        raise ValueError(f"Failed to find route segment from {current_street} to {next_street}")
                except ValueError as e:
                    raise ValueError(f"Failed to find route segment from {current_street} to {next_street}: {str(e)}")

            # Update current street for next iteration
            current_street = next_street

        # Combine segments into a single route
        if not segment_routes:
            raise ValueError("No route segments were created")

        combined_path = []
        combined_street_path = []
        combined_segments = []
        total_distance = 0
        total_time = 0
        traffic_counts = {state: 0 for state in TrafficState}

        # Define mandatory streets for later use
        mandatory_streets = set(optimal_order)

        # FIXED: Properly combine segments to ensure the route visits each destination in optimal order
        print("\nCombining route segments...")
        
        # Create a mapping from destinations to their position in the optimal order
        optimal_order_positions = {street: i for i, street in enumerate(optimal_order)}
        
        for i, segment in enumerate(segment_routes):
            if not segment.success:
                street_from = optimal_order[i]
                street_to = optimal_order[i+1]
                raise ValueError(f"Segment {i+1} ({street_from} to {street_to}) failed")

            # Print segment details for debugging
            print(f"Segment {i+1}: {len(segment.path)} nodes, {segment.total_distance:.0f}m, from {optimal_order[i]} to {optimal_order[i+1]}")

            # Add path, avoiding duplicating nodes between segments
            if i == 0:
                combined_path.extend(segment.path)
                # Also add all streets for the first segment
                combined_street_path.extend(segment.street_path)
            else:
                # Check if we can connect segments properly
                if combined_path[-1] == segment.path[0]:
                    # Skip the first node to avoid duplication
                    combined_path.extend(segment.path[1:])
                else:
                    print(f"Warning: Gap between segments {i} and {i+1}")
                    print(f"  Last node of previous segment: {combined_path[-1]}")
                    print(f"  First node of current segment: {segment.path[0]}")
                    # We have a gap, so add all nodes
                    combined_path.extend(segment.path)
                
                # FIXED: For streets, we need to be smarter about including waypoints
                for j, street in enumerate(segment.street_path):
                    # Always include the first street of a segment (it's a waypoint)
                    # or include any street that's not a duplicate of the previous street
                    if (j == 0 and street in mandatory_streets) or \
                      (not combined_street_path or combined_street_path[-1] != street):
                        combined_street_path.append(street)

            # Add all segments
            combined_segments.extend(segment.segments)

            # Accumulate statistics
            total_distance += segment.total_distance
            total_time += segment.total_time

            # Accumulate traffic counts
            for state, percentage in segment.traffic_distribution.items():
                # Convert percentage back to distance
                distance = percentage * segment.total_distance / 100
                traffic_counts[state] += distance

        # Verify all mandatory streets are in the path
        # Create sets for easier checking
        combined_street_set = set(combined_street_path)
        missing_streets = mandatory_streets - combined_street_set
        
        if missing_streets:
            print(f"\nWarning: Some mandatory streets are missing from the combined path: {missing_streets}")
            print("Ensuring all mandatory streets are included...")
            
            # FIXED: Better approach to insert missing streets at appropriate positions
            for missing_street in missing_streets:
                # Find the position in the optimal order
                missing_idx = optimal_order.index(missing_street)
                
                # Find where to insert it in the combined path
                if missing_idx == 0:
                    # Insert at the beginning if it's the start street
                    combined_street_path.insert(0, missing_street)
                else:
                    # Find the previous street in optimal order
                    prev_street = optimal_order[missing_idx - 1]
                    
                    # Try to find the position after the previous street
                    if prev_street in combined_street_path:
                        insert_pos = combined_street_path.index(prev_street) + 1
                        combined_street_path.insert(insert_pos, missing_street)
                    else:
                        # Fallback - insert based on next street if available
                        next_idx = missing_idx + 1
                        if next_idx < len(optimal_order):
                            next_street = optimal_order[next_idx]
                            if next_street in combined_street_path:
                                insert_pos = combined_street_path.index(next_street)
                                combined_street_path.insert(insert_pos, missing_street)
                                continue
                        
                        # If all else fails, just append to the end
                        print(f"  Could not determine proper position for {missing_street}, appending to end")
                        combined_street_path.append(missing_street)
        
        # Calculate combined traffic distribution
        if total_distance > 0:
            traffic_distribution = {
                state: (distance / total_distance * 100)
                for state, distance in traffic_counts.items()
            }
        else:
            traffic_distribution = {state: 0 for state in TrafficState}

        # Create combined route result
        combined_route = RouteResult(
            path=combined_path,
            street_path=combined_street_path,
            total_distance=total_distance,
            total_time=total_time,
            success=True,
            traffic_distribution=traffic_distribution,
            segments=combined_segments
        )

        # Report total time and statistics
        elapsed = time.time() - start_time
        print(f"\n==== Multi-stop route completed in {elapsed:.2f} seconds ====")
        print(f"Total route: {len(combined_path)} nodes, {combined_route.total_distance:.0f}m, {combined_route.total_time:.1f}s")
        print(f"Street sequence: {' → '.join(combined_street_path)}")
        
        # Verify that all destination streets are in the final path
        all_destinations_included = all(street in combined_street_path for street in destination_streets)
        optimal_order_preserved = True
        
        # Check if optimal order is preserved by finding the indices of each street in the combined path
        street_indices = {street: combined_street_path.index(street) if street in combined_street_path else -1 
                        for street in optimal_order}
        
        # Check if the order matches
        for i in range(1, len(optimal_order)):
            if street_indices[optimal_order[i-1]] > street_indices[optimal_order[i]]:
                optimal_order_preserved = False
                break
        
        print(f"All destinations included: {'Yes' if all_destinations_included else 'No'}")
        print(f"Optimal order preserved: {'Yes' if optimal_order_preserved else 'No'}")

        return combined_route

    def _create_modified_graph_with_penalties(self, visited_streets, visited_edges, exempt_streets=None):
        """
        Create a modified copy of the network graph with penalties for already visited streets,
        but exempting streets that are still in our destination list.
        
        Args:
            visited_streets: Set of street names that have already been visited
            visited_edges: Set of (from_node, to_node) tuples that have already been traversed
            exempt_streets: Set of street names that should be exempt from penalties (remaining destinations)
        
        Returns:
            A modified copy of the network graph
        """
        # Create a deep copy of the graph
        import copy
        modified_graph = copy.deepcopy(self.network.graph)
        
        # Initialize exempt_streets if not provided
        if exempt_streets is None:
            exempt_streets = set()
        
        # Count penalized edges for reporting
        penalized_edges = 0
        
        # Apply penalties to edges on visited streets
        for u, v, data in modified_graph.edges(data=True):
            street_name = data.get('street_name')
            
            # Skip penalty if this street is a remaining destination
            if street_name in exempt_streets:
                continue
                    
            # Higher penalty for edges we've directly traversed
            if (u, v) in visited_edges or (v, u) in visited_edges:
                # Apply a significant penalty to directly traversed edges
                data['length'] = data['length'] * 5.0
                penalized_edges += 1
            # Smaller penalty for any edge on a street we've visited
            elif street_name in visited_streets:
                # Apply a moderate penalty to edges on visited streets
                data['length'] = data['length'] * 2.0
                penalized_edges += 1
        
        print(f"Applied penalties to {penalized_edges} edges")
        
        return modified_graph

    def _create_modified_graph_with_penalties(self, visited_streets, visited_edges, exempt_streets=None):
        """
        Create a modified copy of the network graph with penalties for already visited streets,
        but exempting streets that are still in our destination list.
        
        Args:
            visited_streets: Set of street names that have already been visited
            visited_edges: Set of (from_node, to_node) tuples that have already been traversed
            exempt_streets: Set of street names that should be exempt from penalties (remaining destinations)
        
        Returns:
            A modified copy of the network graph
        """
        # Create a deep copy of the graph
        import copy
        modified_graph = copy.deepcopy(self.network.graph)
        
        # Initialize exempt_streets if not provided
        if exempt_streets is None:
            exempt_streets = set()
        
        # Count penalized edges for reporting
        penalized_edges = 0
        
        # Apply penalties to edges on visited streets
        for u, v, data in modified_graph.edges(data=True):
            street_name = data.get('street_name')
            
            # Skip penalty if this street is a remaining destination
            if street_name in exempt_streets:
                continue
                    
            # Higher penalty for edges we've directly traversed
            if (u, v) in visited_edges or (v, u) in visited_edges:
                # Apply a significant penalty to directly traversed edges
                data['length'] = data['length'] * 5.0
                penalized_edges += 1
            # Smaller penalty for any edge on a street we've visited
            elif street_name in visited_streets:
                # Apply a moderate penalty to edges on visited streets
                data['length'] = data['length'] * 2.0
                penalized_edges += 1
        
        print(f"Applied penalties to {penalized_edges} edges")
        
        return modified_graph

    def _check_connectivity(self, start_nodes, end_nodes):
        """Check if any path exists between start and end nodes using bidirectional search."""
        print("Checking path existence...")

        # For very large node sets, sample a subset
        if len(start_nodes) > 20 or len(end_nodes) > 20:
            start_sample = random.sample(list(start_nodes), min(20, len(start_nodes)))
            end_sample = random.sample(list(end_nodes), min(20, len(end_nodes)))
        else:
            start_sample = list(start_nodes)
            end_sample = list(end_nodes)

        # Try to find any path between the samples
        for start_node in start_sample:
            for end_node in end_sample:
                try:
                    if nx.has_path(self.network.graph, start_node, end_node):
                        return True
                except Exception as e:
                    continue

        # Fall back to more thorough check if samples don't find a path
        if len(start_sample) < len(start_nodes) or len(end_sample) < len(end_nodes):
            print("Initial sample check failed, performing more thorough check...")
            # Try bidirectional expansion for a limited number of steps
            forward_frontier = set(start_nodes)
            backward_frontier = set(end_nodes)
            visited_forward = set(forward_frontier)
            visited_backward = set(backward_frontier)

            max_steps = 10
            for _ in range(max_steps):
                # Expand forward
                new_forward = set()
                for node in forward_frontier:
                    neighbors = set(self.network.graph.neighbors(node))
                    new_forward.update(neighbors - visited_forward)

                visited_forward.update(new_forward)
                forward_frontier = new_forward

                # Check intersection
                if not visited_forward.isdisjoint(visited_backward):
                    return True

                # Expand backward
                new_backward = set()
                for node in backward_frontier:
                    neighbors = set(self.network.graph.predecessors(node)
                                if self.network.graph.is_directed()
                                else self.network.graph.neighbors(node))
                    new_backward.update(neighbors - visited_backward)

                visited_backward.update(new_backward)
                backward_frontier = new_backward

                # Check intersection
                if not visited_forward.isdisjoint(visited_backward):
                    return True

                # Early termination if frontiers are empty
                if not forward_frontier or not backward_frontier:
                    break

        return False

    def _select_promising_nodes(self, start_nodes, end_nodes):
        """Select most promising nodes based on connectivity and other metrics."""
        # Calculate node scores based on connectivity and other properties
        start_scores = []
        for node in start_nodes:
            connectivity = self.network.graph.nodes[node].get('connectivity', 0)
            # Higher score for non-bottleneck nodes with good connectivity
            is_bottleneck = 1 if node in self.network.bottleneck_nodes else 0
            score = connectivity * (2 - is_bottleneck)
            start_scores.append((node, score))

        end_scores = []
        for node in end_nodes:
            connectivity = self.network.graph.nodes[node].get('connectivity', 0)
            is_bottleneck = 1 if node in self.network.bottleneck_nodes else 0
            score = connectivity * (2 - is_bottleneck)
            end_scores.append((node, score))

        # Sort by score and take top N nodes
        start_scores.sort(key=lambda x: x[1], reverse=True)
        end_scores.sort(key=lambda x: x[1], reverse=True)

        # Take top 5 or fewer if not enough nodes
        top_start = [node for node, _ in start_scores[:min(5, len(start_scores))]]
        top_end = [node for node, _ in end_scores[:min(5, len(end_scores))]]

        # For diversity, include a random node if we have more than 5
        if len(start_nodes) > 5:
            remaining = list(set(start_nodes) - set(top_start))
            if remaining:
                random_node = random.choice(remaining)
                if random_node not in top_start:
                    top_start.append(random_node)

        if len(end_nodes) > 5:
            remaining = list(set(end_nodes) - set(top_end))
            if remaining:
                random_node = random.choice(remaining)
                if random_node not in top_end:
                    top_end.append(random_node)

        return top_start, top_end

    def _improved_train_route(self, start_node: str, end_node: str,
                     min_episodes: int,
                     max_episodes: int,
                     success_threshold: float) -> Optional[RouteResult]:
        """Enhanced RL training for very long routes with performance optimizations."""

        # Save and reset agent's exploration parameters
        original_epsilon = self.agent.epsilon
        self.agent.epsilon = 0.9  # High exploration rate

        # Use cached shortest path if available
        path_key = f"{start_node}_{end_node}"
        if path_key in self.shortest_path_cache:
            shortest_path = self.shortest_path_cache[path_key]
            shortest_length = len(shortest_path)
            print(f"Using cached shortest path length: {shortest_length} nodes")
        else:
            # Get shortest path info for guidance
            try:
                shortest_path = nx.shortest_path(self.network.graph, start_node, end_node)
                shortest_length = len(shortest_path)
                # Cache the result
                self.shortest_path_cache[path_key] = shortest_path
                print(f"Shortest path length: {shortest_length} nodes")
            except:
                print("Could not find shortest path for guidance")
                shortest_path = None
                shortest_length = 1000  # Default if no path found

        # Create waypoints for long paths to improve exploration
        if shortest_path and shortest_length > 50:
            print(f"Path is very long. Creating waypoints...")
            step_size = max(1, len(shortest_path)//5)
            waypoints = [shortest_path[i] for i in range(0, len(shortest_path), step_size)]
            if end_node not in waypoints:
                waypoints.append(end_node)
            print(f"Created {len(waypoints)} waypoints")
        else:
            waypoints = [end_node]

        # Calculate distance matrix for reward shaping (with caching)
        distance_to_end = {}
        # Define the bounded subgraph to work with
        bounded_nodes = set()

        if end_node in self.distance_cache:
            print("Using cached distance data")
            distance_to_end = self.distance_cache[end_node]
        else:
            print("Building distance cache...")
            # Use Dijkstra's algorithm once instead of multiple shortest_path_length calls
            lengths = nx.single_source_dijkstra_path_length(self.network.graph, end_node)
            distance_to_end = lengths

            # Cache for future use
            self.distance_cache[end_node] = distance_to_end

        # Create bounded search space for efficiency
        if shortest_path:
            search_distance = min(shortest_length * 2, 500)  # Reasonable upper bound
            for node in self.network.graph.nodes():
                if node in distance_to_end and distance_to_end[node] <= search_distance:
                    bounded_nodes.add(node)

            # Always include shortest path nodes
            bounded_nodes.update(shortest_path)
            print(f"Bounded search space: {len(bounded_nodes)} nodes")
        else:
            # If no shortest path, use a larger bounded area
            bounded_nodes = set(self.network.graph.nodes())

        # Create subgraph for faster operations
        if len(bounded_nodes) < len(self.network.graph.nodes()):
            subgraph = self.network.graph.subgraph(bounded_nodes)
            print(f"Using subgraph with {len(subgraph)} nodes and {subgraph.number_of_edges()} edges")
        else:
            subgraph = self.network.graph

        successful_paths = []
        best_reward = float('-inf')
        best_path = None

        # Tracking variables for early stopping
        best_progress = 0
        stagnation_count = 0
        success_streak = 0

        # Adjust episode count based on path complexity
        adjusted_max_episodes = min(max_episodes, max(min_episodes, shortest_length * 20))
        print(f"Will run up to {adjusted_max_episodes} episodes")

        # Precompute node neighbors for faster access during training
        neighbor_cache = {node: list(subgraph.neighbors(node)) for node in bounded_nodes}

        # Precompute states for frequently visited nodes
        state_cache = {}

        # Track time for monitoring
        import time
        start_time = time.time()
        last_report_time = start_time

        # Training loop
        for episode in range(adjusted_max_episodes):
            current = start_node
            path = [current]
            total_reward = 0
            visited = {current}

            # Try to reach each waypoint in sequence
            for waypoint_idx, target in enumerate(waypoints):
                # Reset for each waypoint segment
                steps_to_target = 0
                max_steps_to_target = max(100, shortest_length)

                while current != target and steps_to_target < max_steps_to_target:
                    # Get state (with caching for frequently visited nodes)
                    if current in state_cache:
                        state = state_cache[current]
                    else:
                        state = self._get_state(current)
                        # Only cache states for a limited number of nodes to avoid memory issues
                        if len(state_cache) < 10000:  # Limit cache size
                            state_cache[current] = state

                    # Consider neighbors that haven't been visited in this segment
                    valid_actions = [n for n in neighbor_cache.get(current, [])
                                  if n not in visited or steps_to_target > 50]

                    if not valid_actions:
                        break

                    # Exploration-exploitation balance with dynamic adjustment
                    explore_rate = self.agent.epsilon * (1 - (steps_to_target / max_steps_to_target * 0.5))

                    # Choose action with targeted exploration
                    if random.random() < explore_rate:
                        # Guided random selection - bias toward nodes closer to target
                        if random.random() < 0.7 and target in distance_to_end:
                            # Sort by distance to target and pick from first half
                            candidates = [(n, distance_to_end.get(n, 1000)) for n in valid_actions if n in distance_to_end]
                            if candidates:
                                candidates.sort(key=lambda x: x[1])
                                next_node = candidates[0][0] if random.random() < 0.3 else random.choice(candidates[:max(1, len(candidates)//2)])[0]
                            else:
                                next_node = random.choice(valid_actions)
                        else:
                            next_node = random.choice(valid_actions)
                    else:
                        next_node = self.agent.choose_action(state, valid_actions, is_training=True)

                    # Fast reward calculation
                    edge = subgraph[current][next_node]
                    traffic_multiplier = 1 + (edge['traffic_state'].value * 0.25)
                    time_cost = edge['length'] / edge['speed_limit'] * traffic_multiplier
                    base_reward = -time_cost

                    # Efficient progress reward
                    current_distance = distance_to_end.get(current, 1000)
                    next_distance = distance_to_end.get(next_node, 1000)
                    progress_reward = (current_distance - next_distance) * 20


                    # Waypoint bonuses for guided learning
                    waypoint_bonus = 0
                    if next_node == target:
                        waypoint_bonus = 500  # Large bonus for reaching waypoint

                    reward = base_reward + progress_reward + waypoint_bonus

                    # Update Q-values
                    next_state = self._get_state(next_node)
                    next_valid_actions = [n for n in neighbor_cache.get(next_node, [])
                                        if n not in visited or steps_to_target > 50]
                    self.agent.update(state, next_node, reward, next_state, next_valid_actions)

                    # Move to next state
                    current = next_node
                    path.append(current)
                    visited.add(current)
                    total_reward += reward
                    steps_to_target += 1

                # If we couldn't reach this waypoint, break the segment loop
                if current != target:
                    break

            # Episode statistics and reporting
            episode_success = (current == end_node)

            # Only consider paths that reached the destination
            if episode_success:
                success_streak += 1
                successful_paths.append((path.copy(), total_reward))

                # Update best path if this is better
                if total_reward > best_reward:
                    best_reward = total_reward
                    best_path = path.copy()
                    stagnation_count = 0
                    print(f"Episode {episode+1}: New best path found! Length: {len(best_path)}, Reward: {best_reward:.1f}")
                else:
                    stagnation_count += 1
            else:
                success_streak = 0

            # Calculate progress percentage
            if waypoints and current in distance_to_end and end_node in distance_to_end:
                max_distance = distance_to_end[start_node] if start_node in distance_to_end else 1000
                current_distance = distance_to_end[current]
                progress = (max_distance - current_distance) / max_distance * 100
                best_progress = max(best_progress, progress)

            # Progress reporting
            current_time = time.time()
            if episode_success or (current_time - last_report_time > 5.0) or episode == 0 or episode == adjusted_max_episodes-1:
                elapsed = current_time - start_time
                success_rate = len(successful_paths) / (episode + 1) * 100
                print(f"Episode {episode+1}/{adjusted_max_episodes}: " +
                      f"Success: {'Yes' if episode_success else 'No'}, " +
                      f"Best progress: {best_progress:.1f}%, " +
                      f"Success rate: {success_rate:.1f}%, " +
                      f"Elapsed: {elapsed:.1f}s")
                last_report_time = current_time

            # Early stopping conditions
            if episode >= min_episodes:
                # Stop if we have a good success rate and a reasonable number of samples
                if (len(successful_paths) / (episode + 1)) >= success_threshold and len(successful_paths) >= 10:
                    print(f"Early stopping at episode {episode+1}: Success threshold reached")
                    break

                # Stop if we're not making progress after enough episodes
                if stagnation_count > min(1000, adjusted_max_episodes // 5) and len(successful_paths) > 0:
                    print(f"Early stopping at episode {episode+1}: Stagnation detected")
                    break

                # Stop if we've had a consistent streak of successes
                if success_streak >= 20:
                    print(f"Early stopping at episode {episode+1}: Consistent success streak")
                    break

            # Gradually reduce exploration as training progresses
            if episode % 100 == 0 and episode > 0:
                self.agent.epsilon = max(0.1, self.agent.epsilon * 0.95)

        # Restore original exploration rate
        self.agent.epsilon = original_epsilon

        # Return best route or None if no successful path was found
        if best_path:
            return self._create_route_result(best_path)
        elif successful_paths:
            # Fallback to best successful path if best_path wasn't set
            best_path, _ = max(successful_paths, key=lambda x: x[1])
            return self._create_route_result(best_path)
        else:
            print("No successful path found")
            return None

# ----------------------- LogisticsOptimizer -----------------------
@dataclass
class LogisticsDestination:
    dest_street: str
    demand: float

@dataclass
class LogisticsRequest:
    source_street: str
    capacity: float

@dataclass
class TransportAllocation:
    source_street: str
    dest_street: str
    quantity: float

class LogisticsOptimizer:
    """Optimizes transport quantities from sources to destinations using reinforcement learning,
    based on the cost (travel time) associated with moving from one street to another."""

    def __init__(self, network: 'TransportNetwork', route_planner: 'ImprovedRoutePlanner'):
        self.network = network
        self.route_planner = route_planner
        self.costs_cache = {}  # Cache for route costs to avoid recomputation

    def _estimate_transport_cost(self, source: str, destination: str) -> float:
        """
        Estimate transport cost between source and destination by using the route planner
        to find the best route from the source street to the destination street.
        The total travel time of the route is used as the cost.
        """
        cache_key = f"{source}_{destination}"
        if cache_key in self.costs_cache:
            return self.costs_cache[cache_key]

        try:
            # Use the route planner to get a route result for the two streets
            route_result = self.route_planner.find_route(source, destination)
            if route_result.success:
                cost = route_result.total_time  # Use travel time as the cost
            else:
                cost = float('inf')
        except Exception:
            cost = float('inf')

        self.costs_cache[cache_key] = cost
        return cost

    def _get_state_representation(self, current_supply: List[float], current_demand: List[float]) -> Tuple:
        """Create a simplified state representation based on which sources/destinations have capacity."""
        # Convert to binary representation (has supply/demand or not)
        supply_state = tuple(s > 0.1 for s in current_supply)
        demand_state = tuple(d > 0.1 for d in current_demand)
        return (supply_state, demand_state)

    def _get_valid_actions(self, current_supply: List[float], current_demand: List[float],
                           num_sources: int, num_dests: int) -> List[Tuple[int, int]]:
        """Get all valid (source, destination) pairs based on current supply and demand."""
        return [(i, j) for i in range(num_sources) for j in range(num_dests)
                if current_supply[i] > 0.1 and current_demand[j] > 0.1]

    def optimize_transport_allocation(self,
                                      sources: List['LogisticsRequest'],
                                      destinations: List['LogisticsDestination']) -> List['TransportAllocation']:
        """
        Optimize transport allocation from sources to destinations using Q-learning RL and route cost
        estimation based on street-to-street travel times.
        """
        print(f"Optimizing transport allocation from {len(sources)} sources to {len(destinations)} destinations")

        num_sources = len(sources)
        num_dests = len(destinations)

        # Build the cost matrix using the updated cost estimation function
        costs = np.zeros((num_sources, num_dests))
        for i, source in enumerate(sources):
            for j, dest in enumerate(destinations):
                costs[i, j] = self._estimate_transport_cost(source.source_street, dest.dest_street)

        # Compute total supply and demand
        total_supply = sum(source.capacity for source in sources)
        total_demand = sum(dest.demand for dest in destinations)
        print(f"Total supply: {total_supply}, Total demand: {total_demand}")

        # Scale down demand if needed
        if total_supply < total_demand:
            print("Warning: Supply is less than demand - scaling down demands proportionally")
            scale_factor = total_supply / total_demand
            destinations = [
                LogisticsDestination(dest.dest_street, dest.demand * scale_factor)
                for dest in destinations
            ]
            total_demand = total_supply

        # Q-learning parameters
        num_episodes = 5000
        learning_rate = 0.1
        discount_factor = 0.9
        epsilon = 1.0
        epsilon_decay = 0.995
        min_epsilon = 0.01

        # State mapping dictionary to map state tuples to indices
        state_mapping: Dict[Tuple, int] = {}
        next_state_idx = 0

        # Initialize Q-table with small random values
        # We'll dynamically expand this as we encounter new states
        q_values: Dict[int, np.ndarray] = {}

        # Training loop: iterate over many episodes to update Q-values
        for episode in range(num_episodes):
            # Initialize state: available supply and demand for this episode
            current_supply = [source.capacity for source in sources]
            current_demand = [dest.demand for dest in destinations]

            # Get state representation and map to index
            current_state = self._get_state_representation(current_supply, current_demand)
            if current_state not in state_mapping:
                state_mapping[current_state] = next_state_idx
                # Initialize Q-values for this state with small random values
                q_values[next_state_idx] = np.random.uniform(-0.01, 0.01, (num_sources, num_dests))
                next_state_idx += 1

            current_state_idx = state_mapping[current_state]

            # Continue allocating until one side is exhausted
            while sum(current_supply) > 0 and sum(current_demand) > 0:
                # Determine all valid (source, destination) pairs
                valid_actions = self._get_valid_actions(current_supply, current_demand, num_sources, num_dests)
                if not valid_actions:
                    break

                # Epsilon-greedy action selection
                if random.uniform(0, 1) < epsilon:
                    supplier, destination = random.choice(valid_actions)
                else:
                    # Choose the valid action with the highest Q-value
                    supplier, destination = max(valid_actions,
                                               key=lambda x: q_values[current_state_idx][x[0], x[1]])

                # Determine units to transport (cannot exceed available supply/demand)
                units_to_transport = min(current_supply[supplier], current_demand[destination])

                # Reward is defined as the negative cost scaled by transported units
                # Use a scaling factor to keep rewards manageable
                cost = costs[supplier, destination]
                if np.isinf(cost):
                    reward_value = -1000  # Large negative reward for infinite cost routes
                else:
                    reward_value = -cost * units_to_transport / 100.0  # Scale to prevent extreme values

                # Bounded reward to prevent numerical issues
                reward_value = max(min(reward_value, 1000), -1000)

                # Update state: reduce supply and demand
                current_supply[supplier] -= units_to_transport
                current_demand[destination] -= units_to_transport

                # Get new state representation after action
                next_state = self._get_state_representation(current_supply, current_demand)
                if next_state not in state_mapping:
                    state_mapping[next_state] = next_state_idx
                    q_values[next_state_idx] = np.random.uniform(-0.01, 0.01, (num_sources, num_dests))
                    next_state_idx += 1

                next_state_idx = state_mapping[next_state]

                # Get valid actions for next state
                next_valid_actions = self._get_valid_actions(current_supply, current_demand, num_sources, num_dests)

                # Q-learning update
                old_q = q_values[current_state_idx][supplier, destination]

                # Safely compute max future Q value
                if next_valid_actions:
                    max_future_qs = [q_values[next_state_idx][s, d] for s, d in next_valid_actions]
                    max_future_q = max(max_future_qs) if max_future_qs else 0
                else:
                    max_future_q = 0

                # Safe Q-value update with clipping to prevent numerical issues
                try:
                    td_error = reward_value + discount_factor * max_future_q - old_q
                    td_error = max(min(td_error, 100), -100)  # Clip TD error to reasonable bounds
                    q_values[current_state_idx][supplier, destination] = old_q + learning_rate * td_error
                except (ValueError, OverflowError, RuntimeWarning) as e:
                    # Fallback update in case of numerical issues
                    q_values[current_state_idx][supplier, destination] = old_q + learning_rate * reward_value / 10.0

                # Update current state
                current_state_idx = next_state_idx

            # Decay epsilon after each episode
            epsilon = max(min_epsilon, epsilon * epsilon_decay)

        # Print the final Q-values for the initial state
        initial_state = self._get_state_representation(
            [source.capacity for source in sources],
            [dest.demand for dest in destinations]
        )
        initial_state_idx = state_mapping[initial_state]
        print("Learned Q-table for initial state:")
        print(q_values[initial_state_idx])

        # Use the trained Q-table to perform a greedy allocation (exploitation)
        optimal_allocation_matrix = np.zeros((num_sources, num_dests))
        current_supply = [source.capacity for source in sources]
        current_demand = [dest.demand for dest in destinations]

        while sum(current_supply) > 0 and sum(current_demand) > 0:
            current_state = self._get_state_representation(current_supply, current_demand)
            if current_state not in state_mapping:
                # If we encounter an unseen state, break the loop
                break

            current_state_idx = state_mapping[current_state]
            valid_actions = self._get_valid_actions(current_supply, current_demand, num_sources, num_dests)

            if not valid_actions:
                break

            # Choose the valid action with the highest learned Q-value
            supplier, destination = max(valid_actions,
                                       key=lambda x: q_values[current_state_idx][x[0], x[1]])

            units_to_transport = min(current_supply[supplier], current_demand[destination])
            optimal_allocation_matrix[supplier, destination] += units_to_transport
            current_supply[supplier] -= units_to_transport
            current_demand[destination] -= units_to_transport

        # Convert the allocation matrix into a list of TransportAllocation objects
        allocations = []
        for i in range(num_sources):
            for j in range(num_dests):
                if optimal_allocation_matrix[i, j] > 1e-6:  # Small threshold to handle floating point errors
                    allocations.append(TransportAllocation(
                        source_street=sources[i].source_street,
                        dest_street=destinations[j].dest_street,
                        quantity=int(optimal_allocation_matrix[i, j]) if int(optimal_allocation_matrix[i, j]) == optimal_allocation_matrix[i, j]
                                   else optimal_allocation_matrix[i, j]
                    ))

        print("Optimal Transport Allocations:")
        for alloc in allocations:
            print(f"{alloc.source_street} -> {alloc.dest_street}: {alloc.quantity} units")

        return allocations