const order = [];
const menu = {
  "Burger": 12,
  "Pizza": 15,
  "Salad": 9,
  "Fries": 5,
  "Drink": 3
};

function addItemToOrder(item) {
  order.push(item);
}

function calculateTotal(list) {
  let total = 0;
  for (const item of list) {
    console.log(item);
    total += item;
  }
  return total;
}

addItemToOrder(menu["Burger"]);
addItemToOrder(menu["Fries"]);
addItemToOrder(menu["Drink"]);

console.log(order);
console.log(`Total: ${calculateTotal(order)}`);
