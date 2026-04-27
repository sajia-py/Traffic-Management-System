import streamlit as st
import threading
import queue
import time
import random
import pandas as pd
from threading import Lock

# ====================== SHARED STATE ======================
if 'sharedstate' not in st.session_state:
    st.session_state.sharedstate = {
        "running": False,
        "mode": "FCFS",
        "emergency": False,
        "activedirection": None,
        "vehiclecounts": {"N": 0, "S": 0, "E": 0, "W": 0},
        "avgwaittimes": {"FCFS": 0.0, "RR": 0.0, "PRIORITY": 0.0},
        "total_vehicles": 0,
        "processed": 0,
    }

if 'vehiclequeue' not in st.session_state:
    st.session_state.vehiclequeue = queue.Queue()

if 'theme' not in st.session_state:
    st.session_state.theme = "Dark"   # Default: Dark Mode

shared = st.session_state.sharedstate
q = st.session_state.vehiclequeue
lock = Lock()

directions = ["N", "S", "E", "W"]


# ====================== VEHICLE CLASS ======================
class Vehicle:
    def __init__(self, direction, emergency=False):
        self.direction = direction
        self.emergency = emergency
        self.arrivaltime = time.time()


# ====================== BACKGROUND THREADS ======================
def vehicle_generator():
    while True:
        if shared["running"]:
            direction = random.choice(directions)
            is_emergency = random.random() < 0.12
            vehicle = Vehicle(direction, is_emergency)
            q.put(vehicle)
            with lock:
                shared["vehiclecounts"][direction] += 1
                shared["total_vehicles"] += 1
        time.sleep(random.uniform(0.6, 1.4))


def traffic_controller():
    rr_index = 0
    while True:
        if shared["running"]:
            with lock:
                mode = shared["mode"]
                direction = None

                if mode == "FCFS":
                    if not q.empty():
                        direction = q.queue[0].direction

                elif mode == "RR":
                    direction = directions[rr_index]
                    rr_index = (rr_index + 1) % 4

                elif mode == "PRIORITY":
                    for v in list(q.queue):
                        if v.emergency:
                            direction = v.direction
                            break
                    if direction is None and not q.empty():
                        direction = q.queue[0].direction

                if direction:
                    shared["activedirection"] = direction
                    greentime = 5 if shared["emergency"] else 3

                    wait_list = []
                    processed_now = 0
                    temp = []

                    while not q.empty():
                        v = q.get()
                        if v.direction == direction:
                            wait = time.time() - v.arrivaltime
                            wait_list.append(wait)
                            processed_now += 1
                            if v.emergency:
                                greentime = 6
                        else:
                            temp.append(v)

                    for v in temp:
                        q.put(v)

                    if wait_list:
                        avg = sum(wait_list) / len(wait_list)
                        shared["avgwaittimes"][mode] = round(avg, 2)
                        shared["processed"] += processed_now

                    shared["emergency"] = False
                    time.sleep(greentime)

                shared["activedirection"] = None

        time.sleep(0.3)


# Start threads once
if 'threads_started' not in st.session_state:
    threading.Thread(target=vehicle_generator, daemon=True).start()
    threading.Thread(target=traffic_controller, daemon=True).start()
    st.session_state.threads_started = True


# ====================== STREAMLIT UI ======================
st.set_page_config(page_title="Smart Traffic System", layout="wide")

# Theme Toggle in Top Right
col_title, col_theme = st.columns([3, 1])
with col_title:
    st.title("🚦 Smart Traffic Management System")
with col_theme:
    theme = st.selectbox("Theme", ["Dark", "Light"], 
                        index=0 if st.session_state.theme == "Dark" else 1,
                        label_visibility="collapsed")
    if theme != st.session_state.theme:
        st.session_state.theme = theme
        st.rerun()

st.markdown("### OS Concepts Demo: FCFS • Round Robin • Priority Scheduling")

# Sidebar - Explanation Guide
with st.sidebar:
    st.header("📖 How It Works (User Guide)")

    st.subheader("🎯 Purpose")
    st.write("This simulator shows how **Operating System scheduling algorithms** can be applied to real-world traffic signal control.")

    st.subheader("📌 Algorithms Explained")
    st.markdown("""
    **FCFS (First Come First Serve)**  
    • Oldest waiting vehicle gets green light first.  
    • Simple but can cause long waits for some directions.

    **Round Robin (RR)**  
    • Each direction gets equal fixed-time turn (N → S → E → W).  
    • Fair and prevents starvation.

    **Priority Scheduling**  
    • Emergency vehicles (Ambulance/Fire) get immediate green light.  
    • Best for critical situations.
    """)

    st.subheader("How to Use")
    st.write("""
    1. Select **Dark** or **Light** theme  
    2. Click **Start Simulation**  
    3. Choose scheduling mode  
    4. Trigger emergency to test Priority mode  
    5. Observe live signals, counts & waiting times
    """)

    st.info("Emergency vehicles appear automatically (~12% chance).")


# Set colors based on theme
if st.session_state.theme == "Dark":
    bg_color = "#0e1117"
    card_bg = "#1e1e2e"
    text_color = "#ffffff"
    border_color = "#00ff88"
    inactive_border = "#444"
else:
    bg_color = "#f8f9fa"
    card_bg = "#ffffff"
    text_color = "#000000"
    border_color = "#00aa66"
    inactive_border = "#cccccc"


# Main Controls
col1, col2 = st.columns([1, 1])

with col1:
    st.subheader("🎮 Controls")
    c1, c2 = st.columns(2)
    with c1:
        if st.button("▶️ Start Simulation", type="primary", use_container_width=True):
            shared["running"] = True
    with c2:
        if st.button("⏹ Stop Simulation", type="secondary", use_container_width=True):
            shared["running"] = False

    new_mode = st.radio("Scheduling Algorithm", 
                       ["FCFS", "RR", "PRIORITY"], 
                       horizontal=True, 
                       index=["FCFS", "RR", "PRIORITY"].index(shared["mode"]))
    
    if new_mode != shared["mode"]:
        shared["mode"] = new_mode

    if st.button("🚨 Trigger Emergency Vehicle", type="primary", use_container_width=True):
        shared["emergency"] = True
        shared["mode"] = "PRIORITY"

with col2:
    st.subheader("📊 Live Status")
    status_color = "🟢 Running" if shared["running"] else "🔴 Stopped"
    st.write(f"**Status:** {status_color}")
    st.write(f"**Algorithm:** `{shared['mode']}`")
    st.write(f"**Green Light:** {shared['activedirection'] or 'None'}")
    
    st.write("**Waiting Vehicles:**")
    st.write(shared["vehiclecounts"])
    st.metric("Total Processed", shared["processed"])


# ====================== TRAFFIC LIGHTS ======================
st.subheader("🚥 Live Traffic Signals")

light_cols = st.columns(4)

for i, d in enumerate(directions):
    is_active = shared["activedirection"] == d
    light_emoji = "🟢" if is_active else "🔴"
    light_text = "GREEN" if is_active else "RED"
    current_border = border_color if is_active else inactive_border

    with light_cols[i]:
        st.markdown(f"""
        <div style="text-align:center; padding:20px; border-radius:16px; 
                    background-color:{card_bg}; border: 4px solid {current_border};
                    color:{text_color};">
            <h3>{d} Direction</h3>
            <div style="font-size:75px; margin:10px 0;">{light_emoji}</div>
            <p style="font-weight:bold; color:{'#00ff88' if is_active else '#ff4444'}">
                {light_text}
            </p>
        </div>
        """, unsafe_allow_html=True)


# ====================== ANALYTICS ======================
st.subheader("📈 Average Waiting Time by Algorithm")

if any(shared["avgwaittimes"].values()):
    chart_data = pd.DataFrame({
        "Algorithm": list(shared["avgwaittimes"].keys()),
        "Average Wait Time (seconds)": list(shared["avgwaittimes"].values())
    })

    # Different bar color for light/dark mode
    bar_color = "#00ff88" if st.session_state.theme == "Dark" else "#00aa66"
    
    st.bar_chart(chart_data.set_index("Algorithm"), color=bar_color)

    st.dataframe(
        chart_data.style.format({"Average Wait Time (seconds)": "{:.2f}"}),
        use_container_width=True, 
        hide_index=True
    )
else:
    st.info("Start simulation to see analytics.")


# Auto-refresh when simulation is running
if shared["running"]:
    time.sleep(0.9)
    st.rerun()