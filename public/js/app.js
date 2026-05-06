const API_URL = "/api";

function getToken() {
  return localStorage.getItem("token");
}

function scrollToListings() {
  const section = document.getElementById("lodges");
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
  }
}

function goToRegister() {
  const section = document.getElementById("book-now");
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
  }
}

function getAccommodationImage(type, index) {
  const cottageImages = [
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80"
  ];

  const lodgeImages = [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=900&q=80"
  ];

  if (type === "Cottage") {
    return cottageImages[index % cottageImages.length];
  }

  return lodgeImages[index % lodgeImages.length];
}

async function register() {
  const full_name = document.getElementById("regName")?.value;
  const email = document.getElementById("regEmail")?.value;
  const password = document.getElementById("regPassword")?.value;

  const response = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name, email, password }),
  });

  const data = await response.json();
  alert(data.message);

  if (response.ok) {
    document.getElementById("regName").value = "";
    document.getElementById("regEmail").value = "";
    document.getElementById("regPassword").value = "";
  }
}

async function login() {
  const email = document.getElementById("loginEmail")?.value;
  const password = document.getElementById("loginPassword")?.value;

  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (data.token) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.user.role);

    if (data.user.role === "Administrator") {
      window.location.href = "admin.html";
    } else if (data.user.role === "Staff") {
      window.location.href = "staff.html";
    } else {
      window.location.href = "customer.html";
    }
  } else {
    alert(data.message);
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

// HOMEPAGE LISTING STYLE
async function loadHomeAccommodations() {
  const list = document.getElementById("featuredAccommodationList");
  if (!list) return;

  const response = await fetch(`${API_URL}/accommodations`);
  const accommodations = await response.json();

  list.innerHTML = "";

  accommodations.forEach((acc, index) => {
    const image = getAccommodationImage(acc.type, index);

    list.innerHTML += `
      <div class="property-card">
        <div class="property-image">
          <img src="${image}" alt="${acc.name}">
        </div>

        <div class="property-content">
          <div class="property-info">
            <h3>${acc.name}</h3>
            <span class="property-badge">${acc.type}</span>
            <p><strong>Capacity:</strong> ${acc.capacity} guests</p>
            <p><strong>Description:</strong> Comfortable and relaxing ${acc.type.toLowerCase()} accommodation for your resort stay.</p>
            <p><strong>Amenities:</strong> Air-conditioned room, private space, relaxing atmosphere</p>
          </div>

          <div class="property-price-box">
            <div>
              <div class="property-status">${acc.status}</div>
              <div class="property-price">₱${acc.price}</div>
              <small>per night / stay</small>
            </div>

            <button class="property-btn" onclick="goToRegister()">Reserve now</button>
          </div>
        </div>
      </div>
    `;
  });
}

// DASHBOARD ACCOMMODATION LIST
async function loadAccommodations() {
  const response = await fetch(`${API_URL}/accommodations`);
  const accommodations = await response.json();

  const list = document.getElementById("accommodationList");
  const select = document.getElementById("accommodationSelect");

  if (list) list.innerHTML = "";
  if (select) select.innerHTML = "";

  accommodations.forEach((acc) => {
    if (list) {
      list.innerHTML += `
        <div class="item">
          <h3>${acc.name}</h3>
          <p><b>Type:</b> ${acc.type}</p>
          <p><b>Capacity:</b> ${acc.capacity} guests</p>
          <p><b>Price:</b> ₱${acc.price}</p>
          <p><b>Status:</b> ${acc.status}</p>
        </div>
      `;
    }

    if (select) {
      select.innerHTML += `
        <option value="${acc.id}">${acc.name} - ₱${acc.price}</option>
      `;
    }
  });
}

async function addAccommodation() {
  const name = document.getElementById("accName").value;
  const type = document.getElementById("accType").value;
  const capacity = document.getElementById("accCapacity").value;
  const price = document.getElementById("accPrice").value;

  const response = await fetch(`${API_URL}/accommodations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ name, type, capacity, price }),
  });

  const data = await response.json();
  alert(data.message);
  loadAccommodations();
}

async function bookAccommodation() {
  const accommodation_id = document.getElementById("accommodationSelect").value;
  const check_in = document.getElementById("checkIn").value;
  const check_out = document.getElementById("checkOut").value;
  const guests = document.getElementById("guests").value;

  const response = await fetch(`${API_URL}/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ accommodation_id, check_in, check_out, guests }),
  });

  const data = await response.json();
  alert(data.message);
  loadBookings();
}

async function loadBookings() {
  const list = document.getElementById("bookingList");
  if (!list) return;

  const response = await fetch(`${API_URL}/bookings`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  const bookings = await response.json();
  list.innerHTML = "";

  bookings.forEach((booking) => {
    const role = localStorage.getItem("role");

    list.innerHTML += `
      <div class="item">
        <h3>${booking.accommodation_name}</h3>
        <p><b>Guest:</b> ${booking.full_name || "My Booking"}</p>
        <p><b>Check-in:</b> ${booking.check_in}</p>
        <p><b>Check-out:</b> ${booking.check_out}</p>
        <p><b>Guests:</b> ${booking.guests}</p>
        <p><b>Status:</b> ${booking.status}</p>

        ${
          role !== "Customer"
            ? `
              <select onchange="updateBookingStatus(${booking.id}, this.value)">
                <option value="">Update Booking Status</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Checked-in">Checked-in</option>
                <option value="Checked-out">Checked-out</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <div class="payment-box">
                <h4>Record Payment</h4>

                <input type="number" id="amount-${booking.id}" placeholder="Amount Paid">

                <select id="method-${booking.id}">
                  <option value="Cash">Cash</option>
                  <option value="GCash">GCash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>

                <input type="text" id="ref-${booking.id}" placeholder="Reference Number">

                <button class="main-button" onclick="recordPayment(${booking.id})">Record Payment</button>
              </div>
            `
            : ""
        }
      </div>
    `;
  });
}

async function updateBookingStatus(id, status) {
  if (!status) return;

  const response = await fetch(`${API_URL}/bookings/${id}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ status }),
  });

  const data = await response.json();
  alert(data.message);
  loadBookings();
}

async function recordPayment(bookingId) {
  const amount = document.getElementById(`amount-${bookingId}`).value;
  const payment_method = document.getElementById(`method-${bookingId}`).value;
  const reference_no = document.getElementById(`ref-${bookingId}`).value;

  const response = await fetch(`${API_URL}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      booking_id: bookingId,
      amount,
      payment_method,
      payment_status: "Paid",
      reference_no,
    }),
  });

  const data = await response.json();
  alert(data.message);
}

async function loadReports() {
  const reportBox = document.getElementById("reportBox");
  if (!reportBox) return;

  const response = await fetch(`${API_URL}/reports`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  const report = await response.json();

  reportBox.innerHTML = `
    <p><b>Total Bookings:</b> ${report.total_bookings}</p>
    <p><b>Confirmed Bookings:</b> ${report.confirmed_bookings}</p>
    <p><b>Total Sales:</b> ₱${report.total_sales}</p>
  `;
}

// AUTO LOAD HOMEPAGE
document.addEventListener("DOMContentLoaded", () => {
  loadHomeAccommodations();
});