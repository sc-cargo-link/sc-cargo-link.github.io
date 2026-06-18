An app to help organize and plan hauling missions in star citizen. 
Name: CargoLink

# UI:
- should be simple and clean.
- It should be very compact.
- Use shadcn-ui for the UI.
- Use tailwindcss for the styling.
- Use react for the frontend.
- Use typescript for the backend.
- Use vite for the build.

# Pages
- Home page
- Map
- Contracts
- Help

# Home page
- Leave it as TBD.

# Map page
- A simple map that shows all the locations.
- Allow user to select system Pyro, Stanton or Nyx.
- User can select what locations to show star system, planets, moons, lagangian points, and stations.
- User can search for any of these locations.
- data is in src/data/map_data/*
- use tmp/poi_map.html as a reference.


# Contracts page

Have a submenu for preparing contracts, routing and cargo tracking.

## Features
- Upload and scan multiple screenshots and convert them into contracts.
- Plan routes based on contracts
- Record and track cargo.


## Prep: Record Hauling contracts
- User will upload multiple screenshots in one go.
- App will scan the screenshots and convert them into contracts.
- User can edit the contracts if needed.
- User can delete the contracts if needed.
- User can add more contracts if needed.
- User can remove contracts if needed.
- User can reorder contracts if needed.
- User can drag and drop contracts to change order.
- User can see the total cargo at each contract.
- show the screenshot and the recorded contract side by side, and the user should be able to edit the contract.
- Keep all the recorded contracts in local storage, and this will be used in route planning.
- Have a button for clearing all contracts and uploaded screenshots.
- The location should be Stored with entity_name instead of the display name, but show the display name for the user.
- Addd a search bar on the top and allow filtering for contracts with that term, search in pickup, drop off and mission items.

### Scanning contracts
- Use tesseract for OCR.
- Allow user to set bounding box where to scan.
- We will have three locations to scan the reward, the primary objective, and the name.
- All screenshots will use the same bounding box.
- The location name should be identified using map data.
- Every contract should have pick up location[s], pick up item[s] with quantity in SCU and drop off location[s].
- Do the exact location name match with the locations in map data if it's not found, show the top three closest matches as suggestions.
- If user starts typing in the location input, use dropdown to show locations that match from map data.
- The contract item should be one of the items listed in mission_item.txt. If not found, show the top three closest matches as suggestions.
- If user starts typing in the item input, use dropdown to show items that match from mission_item.txt.
- Expand the screenshot in the contracts to fit the full width and make it 70% of the container width.
- When the user clicks on the screenshot, expand it with a pop up.
- In developer mode, add a section on the top of every screenshot that shows the raw OCR for the three zones.
- If the exact match is not found for location or mission item, don't fill it, show it as a suggestion under the input field as chips.
- If there are multiple locations found with the same name, show them as suggestions.
- The suggestion should also include the star system therein.
- Remember the scanned regions in local storage.
- If the scanned regions are set, then don't expand the scanned region section on page load.
- The upload screenshots and the clear button should be above the contract container, show all the images that were uploaded one below the other don't use a sidebar.
- picup doesn't mention how much SCU is there, only delivery has the SCU information and this should reflect on how we show the contract.
- Allow editing the SeU for drop off and allow editing the reward.

#### scanning logic
- We're going to use a specific logic to extract locations and data from those here.
- The pickup location will always proceed with from.
- The drop off location will always proceed with to.
- Location names can have on/to/at that we need to remove.
- we can have multiple pickup and/or drop off locations.
- scu is always the number after the / in the text with SCU after the number.

Examples: 
Deliver 0/2 SCU of Waste to Sunset Mesa on Pyro Il.
- scu: 2
- item: Waste
- pickup location: Sunset Mesa
Deliver 0/20 SCU of Hydrogen to Rustville
- scu: 20
- item: Hydrogen
- pickup location: Rustville
Collect Hydrogen from Patch City
- drop off location: Rustville
- item: Hydrogen


## Routing
### Route planing
- User will set the capacity for their ship in SCU.
- User will set the maximum distance, their ship can travel. Units are GM for giga meters.
- Max distance is the amount a ship can travel without refueling if the plan crosses the max distance, add a stopover.
- I have a button to generate optimal route.
- User will see the planned route and well be able to change it.
- User will be able to see the map and the route on the map.
- use tmp/poi_map.html as a reference.
- The maps should only show routing and locations for the current system selected.
- When the user hovers on the contract and the selection list, show a tool tip of all the details.
- Add filters to the map where user can toggle to show or hide and details in the map. planets, moons, lagangian points, stations, other poi.
- Allow clearing the planned route and start over.
- Show route leg on the line. Should be placed at 20% at the beginning. If there are multiple, show them side by side. Route leg ear number from 1, 2, 3 and so on Starting from the starting location.
- When selecting a leg in the planned route, focus that location in the map.

#### optimal route
- Use will set a starting location.
- User will select which contracts to use using the check box.
- The system builds an optimal route to complete all contracts.
- Each contract can have multiple pickup locations and a single drop off.
- Each contract can have a single pickup location and multiple dropoffs.
- Each contract can be single pick up location and single drop off.
- Contracts can also be comprised of different kinds of materials.
- The route should mention what item needs to be picked up from which contract for each station that the user visits.
- Each visit should not exceed the capacity of user's ship.
- pickup and destinations can be in different star systems, in which case we have to go through a gateway.
- When calculating the route, we should keep in mind the SU size of the ship. If the quantity is more than the ship can carry, then we can take power shell and proceed. And come back to do another run. 
- If we drop some cargo, that should free up some space, so we should be able to pick up more cargo.
- Allow user to configure custom route, the user will select what to pick up and what to drop off based on what contracts are available for that location.
- Assume the user will refuel at every station, so the requirement should only calculate the current station to the next station, if it's not enough show error. 

## Cargo tracking
- User can mark a contract as completed.
- User can mark, pick up and drop off as completed.
- Cargo tracking should follow the planned route and tell the user what to pick up and what to drop off at every location.
- show it as a flow graph.


# Help page
- Leave it as TBD.