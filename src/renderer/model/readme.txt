Read persistence model to in-memory domain model.

Why two separate models?
* in-memory model has different structure (associative arrays for efficient lookup)
* in-memory model uses internal ids to identify objects
* in-memory ids must not be shared with other systems
* persistence model should be agnotic to application requirements (GeoJSON)
