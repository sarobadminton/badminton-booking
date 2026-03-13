const API = "https://script.google.com/macros/s/AKfycbyf4-Y4ZbI8eBuokdPT0ZXdnmjHcBrq2nfOh_ciRM_xnRU4YmNjEIxCyFMZbtpVYwVI/exec"
const LIFF_ID = "2009443961-MV2dzoDm"

let lineUserId = ""
let liffReady = false

async function initLIFF(){

await liff.init({ liffId: LIFF_ID })

if(!liff.isInClient()){
alert("Please open this booking page inside the LINE app.")
return
}

if(!liff.isLoggedIn()){
liff.login()
return
}

const profile = await liff.getProfile()

lineUserId = profile.userId

liffReady = true

console.log("LINE USER:", lineUserId)

}

}

initLIFF()
let selectedCourt
let selectedStart
let bookings = []

let countdownInterval
let remainingTime = 60

const dateInput = document.getElementById("date")
const popup = document.getElementById("bookingPopup")
const overlay = document.getElementById("popupOverlay")

const today = new Date()
const maxDate = new Date()

maxDate.setDate(today.getDate() + 14)

dateInput.value = today.toISOString().split("T")[0]
dateInput.min = today.toISOString().split("T")[0]
dateInput.max = maxDate.toISOString().split("T")[0]


async function loadBookings(){
const res = await fetch(API)
bookings = await res.json()
}


function generateSlots(){
let slots=[]
for(let h=9;h<=23;h++){
let hour=String(h).padStart(2,"0")
slots.push(hour+":00")
}
return slots
}


function formatDate(date){
const d = new Date(date)
return d.toISOString().split("T")[0]
}



function isBooked(court,date,time){

for(let b of bookings){

const bookedCourt = Number(b[1])
const bookedDate = formatDate(b[2])
const start = String(b[3])
const end = String(b[4])
const status = String(b[8] || "").trim()

if(bookedCourt === court && bookedDate === date && status === "BOOKED"){

const slotHour = parseInt(time.split(":")[0])
const startHour = parseInt(start.split(":")[0])
const endHour = parseInt(end.split(":")[0])

if(slotHour >= startHour && slotHour < endHour){
return true
}

}

}

return false
}


function isLocked(court,date,time){

for(let b of bookings){

const bookedCourt = Number(b[1])
const bookedDate = formatDate(b[2])
const start = String(b[3])
const status = String(b[8] || "").trim()
const lockTime = new Date(b[9])

if(status==="LOCK" && bookedCourt===court && bookedDate===date && start===time){

const diff=(new Date()-lockTime)/1000

if(diff < 60){
return true
}

}

}

return false
}


function isPastTime(date,time){

const now = new Date()
const selectedDate = new Date(date)

const [h,m] = time.split(":")
selectedDate.setHours(h)
selectedDate.setMinutes(m)
selectedDate.setSeconds(0)

return selectedDate < now
}


function nextBookedSlot(court,date,startIndex){

const slots = generateSlots()

for(let i=startIndex+1;i<slots.length;i++){

if(isBooked(court,date,slots[i])){
return i
}

}

return slots.length
}


function renderTimeline(){

const date = dateInput.value
const timeline = document.getElementById("timeline")
timeline.innerHTML=""

const slots = generateSlots()

for(let c=1;c<=10;c++){

let row=document.createElement("div")
row.className="court-row"

let name=document.createElement("div")
name.className="court-name"
name.innerText="Court "+c
row.appendChild(name)

slots.forEach(t=>{

let slot=document.createElement("div")

const hour = parseInt(t.split(":")[0])

let price = 0
if(hour >= 9 && hour < 16){
price = 100
}else{
price = 200
}

slot.innerHTML = `
${t}
<br>
<span class="slot-price">${price}฿</span>
`

if(isBooked(c,date,t) || isPastTime(date,t)){
slot.className="slot booked"
}
else if(isLocked(c,date,t)){
slot.className="slot locked"
}
else{
slot.className="slot available"
slot.onclick=()=>openPopup(c,t)
}

row.appendChild(slot)

})

timeline.appendChild(row)

}

}


dateInput.addEventListener("change",async()=>{
await loadBookings()
renderTimeline()
})


async function init(){

await loadBookings()
renderTimeline()

setInterval(async ()=>{

const popupOpen = !popup.classList.contains("hidden")

if(!popupOpen){
await loadBookings()
renderTimeline()
}

},5000)

}


async function openPopup(court,time){

const res = await fetch(API,{
method:"POST",
body:JSON.stringify({
court:court,
date:dateInput.value,
start:time,
status:"LOCK"
})
})

const result = await res.text()

if(result==="LOCKED" || result==="BOOKED"){

alert("This slot is already taken")

await loadBookings()
renderTimeline()
return

}

selectedCourt = court
selectedStart = time

document.getElementById("popupCourt").innerText = "Court "+court
document.getElementById("popupStart").innerText = "Start: "+time

const endSelect = document.getElementById("endTime")
endSelect.innerHTML=""

const slots = generateSlots()
let startIndex = slots.indexOf(time)

const limit = nextBookedSlot(court,dateInput.value,startIndex)

for(let i=startIndex+1;i<=limit;i++){

let option=document.createElement("option")
option.value=slots[i]
option.text=slots[i]

endSelect.appendChild(option)

}

updatePrice()

overlay.classList.remove("hidden")
popup.classList.remove("hidden")

remainingTime = 60
const countdownEl = document.getElementById("countdown")

countdownEl.innerText = "Time remaining: 01:00"

countdownInterval = setInterval(()=>{

remainingTime--

let sec = String(remainingTime).padStart(2,"0")
countdownEl.innerText = "Time remaining: 00:" + sec

if(remainingTime <= 0){

clearInterval(countdownInterval)

alert("Time expired. Slot released.")

closePopup()

}

},1000)

}


function closePopup(){

clearInterval(countdownInterval)

popup.classList.add("hidden")
overlay.classList.add("hidden")

const court = selectedCourt
const start = selectedStart

selectedCourt = null
selectedStart = null

if(court && start){

fetch(API,{
method:"POST",
body:JSON.stringify({
court:court,
date:dateInput.value,
start:start,
status:"UNLOCK"
})
})

}

loadBookings().then(renderTimeline)

}


overlay.onclick = closePopup


document.getElementById("endTime").addEventListener("change",updatePrice)


/* ----------- UPDATED PRICE ENGINE ----------- */

function updatePrice(){

const end=document.getElementById("endTime").value

const startHour=parseInt(selectedStart.split(":")[0])
const endHour=parseInt(end.split(":")[0])

let price = 0

for(let h=startHour; h<endHour; h++){

if(h >= 9 && h < 16){
price += 100
}else{
price += 200
}

}

document.getElementById("price").innerText="Price: "+price+" ฿"

}


/* ----------- CONFIRM BOOKING ----------- */

document.getElementById("confirmBooking").onclick = async function(){

if(!liffReady || !lineUserId){
alert("Please open this page inside LINE to complete booking.")
return
}

const end = document.getElementById("endTime").value
const name = document.getElementById("name").value.trim()
const phone = document.getElementById("phone").value.trim()

if(name === ""){
alert("Please enter your name")
return
}

if(phone === ""){
alert("Please enter your phone number")
return
}

const phoneRegex = /^0[0-9]{8,9}$/

if(!phoneRegex.test(phone)){
alert("Phone number must start with 0 and be 9-10 digits")
return
}

const startHour=parseInt(selectedStart.split(":")[0])
const endHour=parseInt(end.split(":")[0])

let price = 0

for(let h=startHour; h<endHour; h++){

if(h >= 9 && h < 16){
price += 100
}else{
price += 200
}

}

console.log("Sending LINE ID:", lineUserId)

await fetch(API,{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
court:selectedCourt,
date:dateInput.value,
start:selectedStart,
end:end,
name:name,
phone:phone,
lineUserId: lineUserId,
price:price,
status:"BOOKED"
})
})
console.log("LINE ID SENT:", lineUserId)
alert("Booking confirmed")

closePopup()

}


/* -------- PHONE VALIDATION -------- */

const phoneInput = document.getElementById("phone")
const phoneError = document.getElementById("phoneError")

phoneInput.addEventListener("input", function(){

const phone = phoneInput.value.trim()

if(phone === ""){
phoneError.innerText = ""
return
}

if(!/^[0-9]*$/.test(phone)){
phoneError.innerText = "Phone number must contain numbers only"
return
}

if(!phone.startsWith("0")){
phoneError.innerText = "Phone number must start with 0"
return
}

if(phone.length < 9 || phone.length > 10){
phoneError.innerText = "Phone number must be 9–10 digits"
return
}

phoneError.innerText = ""

})

init()
