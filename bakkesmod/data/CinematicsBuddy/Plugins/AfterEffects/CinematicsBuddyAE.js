﻿//Written by: SwiFT EQ and CinderBlock
//Version 1.0
//Compatible with Cinematics Buddy version 0.9.9
//This is written in C++ style because that's what I know.
//Sorry to any Javascript devs who try reading this.



/*
    
    TODO:
        - Make ProgressBar an object in main() that gets passed to the functions
    
*/


// GLOBAL VARIABLES //
var BlueColor = [0.35, 0.45, 0.9];
var OrangeColor = [0.95, 0.55, 0.2];

// RUN THE SCRIPT //
main();

function main()
{
    app.beginUndoGroup("CinematicsBuddyAE Import");
    
    
    TestProgressBar();
    //Create the FileData object. Contains all lines from file, and current line index
    //var FileData = GetFileData();
    //if(FileData.bSuccess == true)
    //{
        //Collect metadata and cars seen. Update current line index in FileData
        //var HeaderData = GetHeaderData(FileData);
        
        //Collect arrays of keyframe data, starting from current line index in FileData
        //var KeyframeData = GetKeyframeData(FileData, HeaderData);
        
        //Create camera and layers and apply keyframe data
        //ApplyKeyframeData(KeyframeData);
    //}
    
    app.endUndoGroup();
}

function TestProgressBar()
{
    //Number of steps in the test
    var NumMainSteps = 3;
    var NumSubSteps = 5;
    
    //Create the dialog
    ProgressDialog(NumMainSteps);
    
    //Iterate through main steps
    for(var i = 0; i < NumMainSteps; ++i)
    {
        //Indicate the current main step and reset the sub bar
        ProgressDialog.MainMessage("Doing main step " + i);
        ProgressDialog.SetSubSteps(NumSubSteps + i);
        
        //Iterate through sub steps
        for(var j = 0; j < NumSubSteps + i; ++j)
        {
            alert(i + ", " + j);
            ProgressDialog.IncrementSub();
        }
        
        //Move to the next main step
        ProgressDialog.IncrementMain();
    }
    
    //Progress is complete. Close dialog
    ProgressDialog.Close();
}
function ProgressDialog(MainSteps)
{
    if(MainSteps <= 0)
    {
        return;
    }
    
    var TheWindow;
    var MainLabel;
    var MainBar;
    var SubLabel;
    var SubBar;

    //Create the dialog box
    TheWindow = new Window("palette", "Progress", undefined, {closeButton: true});
    
    //Create the label and progress bar for the main steps
    MainLabel = TheWindow.add("statictext");
    MainLabel.preferredSize = [450, -1];
    MainBar = TheWindow.add("progressbar", undefined, 0, MainSteps);
    MainBar.preferredSize = [450, -1];

    //Create the label and progress bar for the sub steps
    //SubBar is defaulted to 100 steps, but should be set using SetSubSteps
    SubLabel = TheWindow.add("statictext");
    SubLabel.preferredSize = [450, -1];
    SubBar = TheWindow.add("progressbar", undefined, 0, 100);
    SubBar.preferredSize = [450, -1];

    // MEMBER FUNCTIONS //
    ProgressDialog.IncrementMain = function()
    {
        ++MainBar.value;
    };

    ProgressDialog.IncrementSub = function()
    {
        ++SubBar.value;
    };

    ProgressDialog.MainMessage = function(message)
    {
        MainLabel.text = message;
    };

    ProgressDialog.SubMessage = function(message)
    {
        SubLabel.text = message;
    };

    ProgressDialog.SetSubSteps = function(SubSteps)
    {
        SubBar.maxvalue = SubSteps;
        SubBar.value = 0;
    }

    ProgressDialog.Close = function()
    {
        TheWindow.close();
    };

    //Open the window
    TheWindow.show();
}

function GetFileData()
{
    //Create object to return later
    var FileData = new Object();
    FileData.bSuccess = false;
    FileData.Lines = new Object();
    FileData.CurrentLine = 0;
    
    //Get the current active comp
    var MyComp = app.project.activeItem;
    if(MyComp == null)
    {
        alert("No selected comp");
        return FileData;
    }

    //Get user's file selection
    var ChosenFile = File.openDialog("Choose a Cinematics Buddy export file");

    //Read the file, then close it
    var TheData = new Object();
    if(ChosenFile && ChosenFile.open("r"))
    {
        TheData = ChosenFile.read();        
        ChosenFile.close();
    }
    else
    {
        //File was either not selected or unable to be opened
        alert("Invalid file");
        return FileData;
    }

    //Split entire file into its individual lines
    var AsString = TheData.toString();
    
    var PreprocessingTimer = Date.now();
    var Preprocessed = PreprocessFile(AsString);
    var PreTimer1 = Date.now() - PreprocessingTimer;
    
    var PreprocessingTimer2 = Date.now();
    var Preprocessed2 = PreprocessFile2(AsString);
    var PreTimer2 = Date.now() - PreprocessingTimer2;
    
    alert("Preprocessing1: " + PreTimer1 + "ms" + "\n" + "Preprocessing2: " + PreTimer2 + "ms");
    
    //FileData.Lines = AsSplit;
    FileData.bSuccess = true;
    
    return FileData;
}

function GetHeaderData(FileData)
{
    //Initialize HeaderData object
    var HeaderData = new Object();
    HeaderData.RecordingMetadata = GetRecordingMetadata(FileData);
    HeaderData.ReplayMetadata = GetReplayMetadata(FileData);
    HeaderData.CarsSeen = GetCarsSeen(FileData);    
    
    SkipToKeyframes(FileData);
    
    alert("Keyframes beginning on line " + FileData.CurrentLine);
    
    return HeaderData;
}




// UTILITY FUNCTIONS //
function PreprocessFile(InString)
{
    var Output = [];
    
    //Get all header info
    var IdxStart = 0;
    var IdxEnd = InString.indexOf("\n", InString.indexOf("BEGIN ANIMATION"));
    Output.push(InString.substring(IdxStart, IdxEnd));
    
    //Reset index start to the beginning of the keyframes
    IdxStart = IdxEnd;
    
    //Split all keyframes into separate substrings
    var bIsSplitting = true;
    var bHaveKeyframe = false;
    var StackLevel = 0;
    var KeyframesFound = 0;
    while(bIsSplitting === true)
    {
        ++IdxEnd;
        if(IdxEnd >= InString.length)
        {
            IdxEnd = InString.length;
            bIsSplitting = false;
            
            //Sometimes final line is empty. Don't count it as a keyframe
            if(InString[IdxEnd] != "")
            {
                bHaveKeyframe = true;
            }
        }
        
        //Stack match braces until a full keyframe is found
        if(InString[IdxEnd] === '{')
        {
            ++StackLevel;
        }
        else if(InString[IdxEnd] === '}')
        {
            --StackLevel;
            if(StackLevel === 0)
            {
                bHaveKeyframe = true;
            }
        }
        
        //Put the whole keyframe into a substring and push to the array
        if(bHaveKeyframe === true)
        {
            ++KeyframesFound;
            
            Output.push(InString.substring(IdxStart, IdxEnd)); //TODO: The last empty line is counting as a keyframe. Fix that
            
            IdxStart = IdxEnd + 1;
            if(IdxStart >= InString.length)
            {
                break;
            }
        }
        
        bHaveKeyframe = false;
    }

    //alert("Preprocess1 found " + KeyframesFound + " keyframes");
    //alert(Output[Output.length - 1]);

    return Output;
}

function RemoveWhitespace(InString)
{
    return InString.replace(/^\s+|\s+$/g,'');
}

function GetSplitHeaderLine(ThisLine)
{
    var SplitLine = ThisLine.split(":");
    
    var Output = new Object();
    Output.Label = SplitLine[0];
    Output.Data = RemoveWhitespace(SplitLine.slice(1, SplitLine.length).join());
    
    return Output;
}

function GetRecordingMetadata(FileData)
{
    var RecordingMetadata = new Object();
    RecordingMetadata.Version    = "";
    RecordingMetadata.Camera     = "";
    RecordingMetadata.AverageFPS = -1.0;
    RecordingMetadata.Frames     = -1;
    RecordingMetadata.Duration   = -1.0;
    
    alert("STARTING RECORDING METADATA");
    bHeaderLine = true;
    while(FileData.CurrentLine < FileData.Lines.length)
    {
        if(bHeaderLine == false)
        {
            var ThisLine = FileData.Lines[FileData.CurrentLine];
            if(ThisLine === "")
            {
                ++FileData.CurrentLine;
                break;
            }
            
            //Get the individual data points
            var SplitLine = GetSplitHeaderLine(ThisLine);
            if(SplitLine.Label.indexOf("Version") > -1)          { RecordingMetadata.Version    = SplitLine.Data;             }
            else if(SplitLine.Label.indexOf("Camera") > -1)      { RecordingMetadata.Camera     = SplitLine.Data;             }
            else if(SplitLine.Label.indexOf("Average FPS") > -1) { RecordingMetadata.AverageFPS = parseFloat(SplitLine.Data); }
            else if(SplitLine.Label.indexOf("Frames") > -1)      { RecordingMetadata.Frames     = parseInt(SplitLine.Data);   }
            else if(SplitLine.Label.indexOf("Duration") > -1)    { RecordingMetadata.Duration   = parseFloat(SplitLine.Data); }
        }
        
        bHeaderLine = false;
        ++FileData.CurrentLine;
    }

    return RecordingMetadata;
}

function GetReplayMetadata(FileData)
{
    var ReplayMetadata = new Object();
    ReplayMetadata.Name    = "";
    ReplayMetadata.ID      = "";
    ReplayMetadata.TheDate = "";
    ReplayMetadata.FPS     = -1;
    ReplayMetadata.Frames  = -1;
    
    alert("STARTING REPLAY METADATA");
    bHeaderLine = true;
    while(FileData.CurrentLine < FileData.Lines.length)
    {
        if(bHeaderLine == false)
        {
            var ThisLine = FileData.Lines[FileData.CurrentLine];
            if(ThisLine === "")
            {
                ++FileData.CurrentLine;
                break;
            }
            
            //Get the individual data points
            var SplitLine = GetSplitHeaderLine(ThisLine);
            if(SplitLine.Label.indexOf("Name") > -1)        { ReplayMetadata.Name    = SplitLine.Data;           }
            else if(SplitLine.Label.indexOf("ID") > -1)     { ReplayMetadata.ID      = SplitLine.Data;           }
            else if(SplitLine.Label.indexOf("Date") > -1)   { ReplayMetadata.TheDate = SplitLine.Data;           }
            else if(SplitLine.Label.indexOf("FPS") > -1)    { ReplayMetadata.FPS     = parseInt(SplitLine.Data); }
            else if(SplitLine.Label.indexOf("Frames") > -1) { ReplayMetadata.Frames  = parseInt(SplitLine.Data); }
        }
        
        bHeaderLine = false;
        ++FileData.CurrentLine;
    }

    return ReplayMetadata;
}

function GetCarsSeen(FileData)
{
    var CarsSeen = [];
    var CurrentCar = new Object();
    
    alert("STARTING CARS SEEN");
    bHeaderLine = true;
    while(FileData.CurrentLine < FileData.Lines.length)
    {
        if(bHeaderLine == false)
        {
            var ThisLine = FileData.Lines[FileData.CurrentLine];
            if(ThisLine === "")
            {
                ++FileData.CurrentLine;
                return;
            }
        }
        
        bHeaderLine = false;
        ++FileData.CurrentLine;
    }

    return CarsSeen;
}

function SkipToKeyframes(FileData)
{
    alert("SKIPPING TO KEYFRAMES");
    while(FileData.CurrentLine < FileData.Lines.length)
    {
        var ThisLine = FileData.Lines[FileData.CurrentLine];

        //Skip through all the lines until it finds the keyframe section
        if(ThisLine.indexOf("BEGIN ANIMATION") > -1)
        {
            return;
        }
        
        ++FileData.CurrentLine;
    }
}






// MAIN FUNCTION //
function oldmain()
{
    app.beginUndoGroup("CinematicsBuddyAE Import");

    //Get the current active comp
    var MyComp = app.project.activeItem;
    if(MyComp == null)
    {
        alert("No selected comp");
        app.endUndoGroup();
        return;
    }

    //Create objects and get a handle to the camera
    var Objects = CreateCompObjects(MyComp);
    var CameraLayer = Objects.CameraLayer;
    var BallLayer = Objects.BallLayer;
    
    //Get user's file selection
    var ChosenFile = File.openDialog("Choose a Cinematics Buddy export file");

    //Read the file, then close it
    if(ChosenFile && ChosenFile.open("r"))
    {
        var data = ChosenFile.read();        
        ChosenFile.close();
    }
    else
    {
        //File was either not selected or unable to be opened
        alert("Invalid file");
        RemoveCompObjects(Objects);
        app.endUndoGroup();
        return;
    }

    //Split entire file into its individual lines
    var Lines = data.toString().split("\n");

    //Prepare for parsing lines
    var bFirstLine = true;
    var bReadingHeader = true;
    var VersionNumber = "";
    var CameraName = "";
    var TimeSkip = 0;
    var CompTime = 0;
    var TimeArray = [];
    var CamZoomArray = [];
    var CamPosXArray = [];
    var CamPosYArray = [];
    var CamPosZArray = [];
    var CamRotXArray = [];
    var CamRotYArray = [];
    var CamRotZArray = [];
    var BallPosXArray = [];
    var BallPosYArray = [];
    var BallPosZArray = [];
    var BallRotXArray = [];
    var BallRotYArray = [];
    var BallRotZArray = [];
    
    //Parse all the lines to get useful data
    for(i = 0; i < Lines.length; ++i)
    {
        var ThisLine = Lines[i];
        
        //Check the first line to see if it is a valid CB file. Get the version number from it
        if(bFirstLine)
        {
            bFirstLine = false;
            if(ThisLine.indexOf("Version:") == -1)
            {
                alert("File is not a CinematicsBuddy file. First line needs to have Version:");
                RemoveCompObjects(Objects);
                app.endUndoGroup();
                return;
            }
            
            var VersionNumberSplit = ThisLine.split(" ");
            VersionNumber = VersionNumberSplit.slice(1, VersionNumberSplit.length).join();
            continue;
        }
        
        //Read all the other lines to either get metadata or keyframes
        if(bReadingHeader)
        {
            //Not yet past the header. Get metadata
            //Check if line contains "Camera:". Pull the camera name from that line
            if(ThisLine.indexOf("Camera:") > -1)
            {
                var CameraNameSplit = ThisLine.split(" ");
                CameraLayer.name = CameraNameSplit.slice(1, CameraNameSplit.length).join();
                continue;
            }
            
            //Check if line contains "Framerate:". Calculate TimeSkip from that line
            if(ThisLine.indexOf("Framerate:") > -1)
            {
                var FrameRate = parseInt(ThisLine.split(" ").slice(1, 3).join());
                var CompFramerate = 1 / MyComp.frameDuration;
                var Subframes = FrameRate / CompFramerate;
                TimeSkip = MyComp.frameDuration / Subframes;
                continue;
            }
            
            //Check if line contains "Timestamp". This is the final header line and should be skipped
            if(ThisLine.indexOf("Timestamp") > -1)
            {
                bReadingHeader = false;
                continue;
            }
        }
        else
        {
            //Already past the header. Get all the keyframe data and check if the file is done
            //Check if line contains "END". Remove last empty line
            if(ThisLine.indexOf("END") > -1)
            {
                break;
            }

            //Get the keyframe data and add to arrays
            var LineToConvert = ThisLine.split("\t").slice(3, 10).join();
            Keyframe = ConvertKeyframeData(LineToConvert, MyComp);
            
            CamZoomArray.push(Keyframe.CamZoom);
            CamPosXArray.push(Keyframe.CamPosX);
            CamPosYArray.push(Keyframe.CamPosY);
            CamPosZArray.push(Keyframe.CamPosZ);
            CamRotXArray.push(Keyframe.CamRotX);
            CamRotYArray.push(Keyframe.CamRotY);
            CamRotZArray.push(Keyframe.CamRotZ);
            BallPosXArray.push(Keyframe.BallPosX);
            BallPosYArray.push(Keyframe.BallPosY);
            BallPosZArray.push(Keyframe.BallPosZ);
            BallRotXArray.push(Keyframe.BallRotX);
            BallRotYArray.push(Keyframe.BallRotY);
            BallRotZArray.push(Keyframe.BallRotZ);
            
            TimeArray.push(CompTime);
            CompTime += TimeSkip;
        }
    }

    //Apply the arrays
    CameraLayer.property("Camera Options").property("Zoom").setValuesAtTimes( TimeArray, CamZoomArray);
    CameraLayer.property("Transform").property("X Position").setValuesAtTimes(TimeArray, CamPosXArray);
    CameraLayer.property("Transform").property("Y Position").setValuesAtTimes(TimeArray, CamPosYArray);
    CameraLayer.property("Transform").property("Z Position").setValuesAtTimes(TimeArray, CamPosZArray);
    CameraLayer.property("Transform").property("X Rotation").setValuesAtTimes(TimeArray, CamRotXArray);
    CameraLayer.property("Transform").property("Y Rotation").setValuesAtTimes(TimeArray, CamRotYArray);
    CameraLayer.property("Transform").property("Z Rotation").setValuesAtTimes(TimeArray, CamRotZArray);
    BallLayer.property("Transform").property("X Position").setValuesAtTimes(TimeArray, BallPosXArray);
    BallLayer.property("Transform").property("Y Position").setValuesAtTimes(TimeArray, BallPosYArray);
    BallLayer.property("Transform").property("Z Position").setValuesAtTimes(TimeArray, BallPosZArray);
    BallLayer.property("Transform").property("X Rotation").setValuesAtTimes(TimeArray, BallRotXArray);
    BallLayer.property("Transform").property("Y Rotation").setValuesAtTimes(TimeArray, BallRotYArray);
    BallLayer.property("Transform").property("Z Rotation").setValuesAtTimes(TimeArray, BallRotZArray);

    //Clean up and return
    app.endUndoGroup();
    return "Version " + VersionNumber;
}


// UTILITY FUNCTIONS //
//Create camera, plane, and text objects
function CreateCompObjects(MyComp)
{
    //Objects are added to layers in reverse order of what's seen here
    //Camera should be created last so it will be on top
    var Objects = new Object();
    
    //Grids to approximate field
    CreateGrids(MyComp, Objects);
    
    //Labels in goals
    Objects.BlueGoalLabel = CreateBlueGoalLabel(MyComp);
    Objects.OrangeGoalLabel = CreateOrangeGoalLabel(MyComp);
    
    //Ball null object
    Objects.BallLayer = CreateBall(MyComp);
    
    //Camera
    Objects.CameraLayer = CreateCamera(MyComp);
    
    return Objects;
}

//Create all of the walls, floor, and ceiling reference grids
function CreateGrids(MyComp, Objects)
{
    //Floor
    var FloorLayer = CreateGrid(MyComp, "Floor");
    FloorLayer.property("Position").setValue([0, 0, 0]);
    FloorLayer.property("Scale").setValue([1024 * 2.54, 819.2 * 2.54, 100]);
    FloorLayer.property("X Rotation").setValue(-90);
    
    //Ceiling
    var CeilingLayer = CreateGrid(MyComp, "Ceiling");
    CeilingLayer.property("Position").setValue([0, 2044 * -2.54, 0]);
    CeilingLayer.property("Scale").setValue([1024 * 2.54, 819.2 * 2.54, 100]);
    CeilingLayer.property("X Rotation").setValue(-90);
    
    //Positive X Wall
    var LeftWallLayer = CreateGrid(MyComp, "Left Wall");
    LeftWallLayer.property("Position").setValue([0, 2044 * -2.54 / 2, 4096 * 2.54]);
    LeftWallLayer.property("Scale").setValue([1024 * 2.54, 204.4 * 2.54, 100]);
    LeftWallLayer.property("Effects").property("ADBE Grid").property("Height").setValue(80);
    
    //Negative X Wall
    var RightWallLayer = CreateGrid(MyComp, "Right Wall");
    RightWallLayer.property("Position").setValue([0, 2044 * -2.54 / 2, 4096 * -2.54]);
    RightWallLayer.property("Scale").setValue([1024 * 2.54, 204.4 * 2.54, 100]);
    RightWallLayer.property("Effects").property("ADBE Grid").property("Height").setValue(80);
    
    //Blue goal wall
    var BlueWallLayer = CreateGrid(MyComp, "Blue Wall");
    BlueWallLayer.property("Position").setValue([-5120 * 2.54, 2044 * -2.54 / 2, 0]);
    BlueWallLayer.property("Scale").setValue([819.2 * 2.54, 204.4 * 2.54, 100]);
    BlueWallLayer.property("Y Rotation").setValue(90);
    BlueWallLayer.property("Effects").property("ADBE Grid").property("Width").setValue(22);
    BlueWallLayer.property("Effects").property("ADBE Grid").property("Height").setValue(80);
    BlueWallLayer.property("Effects").property("ADBE Ramp").property("End Color").setValue(BlueColor);
    
    //Orange goal wall
    var OrangeWallLayer = CreateGrid(MyComp, "Orange Wall");
    OrangeWallLayer.property("Position").setValue([5120 * 2.54, 2044 * -2.54 / 2, 0]);
    OrangeWallLayer.property("Scale").setValue([819.2 * 2.54, 204.4 * 2.54, 100]);
    OrangeWallLayer.property("Y Rotation").setValue(90);
    OrangeWallLayer.property("Effects").property("ADBE Grid").property("Width").setValue(22);
    OrangeWallLayer.property("Effects").property("ADBE Grid").property("Height").setValue(80);
    OrangeWallLayer.property("Effects").property("ADBE Ramp").property("Start Color").setValue(OrangeColor);
    
    //Add all grids to objects collection
    Objects.FloorLayer = FloorLayer;
    Objects.CeilingLayer = CeilingLayer;
    Objects.LeftWallLayer = LeftWallLayer;
    Objects.RightWallLayer = RightWallLayer;
    Objects.BlueWallLayer = BlueWallLayer;
    Objects.OrangeWallLayer = OrangeWallLayer;
}

//Create a plane with a grid effect
function CreateGrid(MyComp, GridName)
{
    var NewGrid = MyComp.layers.addSolid([1,1,1], GridName, 1000, 1000, 1);
    NewGrid.guideLayer = true;
    NewGrid.threeDLayer = true;
    
    //Gradient ramp effect
    var GradientEffect = NewGrid.property("Effects").addProperty("ADBE Ramp");
    GradientEffect.property("Start of Ramp").setValue([0, 500]);
    GradientEffect.property("End of Ramp").setValue([1000, 500]);
    GradientEffect.property("Start Color").setValue(BlueColor);
    GradientEffect.property("End Color").setValue(OrangeColor);
    
    //Grid effect
    var GridEffect = NewGrid.property("Effects").addProperty("ADBE Grid");
    GridEffect.property("Size From").setValue(3);
    GridEffect.property("Width").setValue(16);
    GridEffect.property("Height").setValue(20);
    GridEffect.property("Border").setValue(2);
    GridEffect.property("Blending Mode").setValue(3);
    
    return NewGrid;
}

//Create camera 
function CreateCamera(MyComp)
{
    var CameraLayer = MyComp.layers.addCamera("UNNAMED CAMERA", [MyComp.width / 2, MyComp.height / 2]);
    CameraLayer.autoOrient = AutoOrientType.NO_AUTO_ORIENT;
    CameraLayer.property("Position").dimensionsSeparated = true;
    
    return CameraLayer;
}

//Create ball
function CreateBall(MyComp)
{
    var BallLayer = MyComp.layers.addNull();
    BallLayer.name = "Ball Null Object";
    BallLayer.threeDLayer = true;
    BallLayer.property("Position").dimensionsSeparated = true;
    
    return BallLayer;
}

//Create text label filling blue goal
function CreateBlueGoalLabel(MyComp)
{
    var BlueGoalLabel = MyComp.layers.addText("Blue Goal");
    BlueGoalLabel.guideLayer = true;
    BlueGoalLabel.threeDLayer = true;
    BlueGoalLabel.property("Position").setValue([-5120 * 2.54, -600, 0]);
    BlueGoalLabel.property("Y Rotation").setValue(-90);
    var TextDocument = BlueGoalLabel.property("Source Text").value;
    TextDocument.font = "Arial-BoldMT";
    TextDocument.fontSize = 1000;
    TextDocument.fillColor = BlueColor;
    TextDocument.strokeColor = [0, 0, 0];
    TextDocument.strokeWidth = 50;
    BlueGoalLabel.property("Source Text").setValue(TextDocument);
    
    return BlueGoalLabel;
}

//Create text label filling orange goal
function CreateOrangeGoalLabel(MyComp)
{
    var OrangeGoalLabel = MyComp.layers.addText("Orange Goal");
    OrangeGoalLabel.guideLayer = true;
    OrangeGoalLabel.threeDLayer = true;
    OrangeGoalLabel.property("Position").setValue([5120 * 2.54, -600, 0]);
    OrangeGoalLabel.property("Y Rotation").setValue(90);
    var TextDocument = OrangeGoalLabel.property("Source Text").value;
    TextDocument.font = "Arial-BoldMT";
    TextDocument.fontSize = 750;
    TextDocument.fillColor = OrangeColor;
    TextDocument.strokeColor = [0, 0, 0];
    TextDocument.strokeWidth = 50;
    OrangeGoalLabel.property("Source Text").setValue(TextDocument);
    
    return OrangeGoalLabel;
}

//Delete the comp objects
function RemoveCompObjects(Objects)
{
    Objects.CameraLayer.remove();
    Objects.BallLayer.remove();
    Objects.FloorLayer.remove();
    Objects.CeilingLayer.remove();
    Objects.LeftWallLayer.remove();
    Objects.RightWallLayer.remove();
    Objects.BlueWallLayer.remove();
    Objects.OrangeWallLayer.remove();
    Objects.BlueGoalLabel.remove();
    Objects.OrangeGoalLabel.remove();
}

//Convert keyframe data from RL's coordinates to AE's coordinates
function ConvertKeyframeData(ThisLine, MyComp)
{
    //Camera data
    var CamZoom = GetZoom(ThisLine.split(",").slice(0,1), MyComp);
    var CamPosition = GetPosition(ThisLine.split(",").slice(1,4));
    var CamRotation = GetRotation(ThisLine.split(",").slice(4,8));
    
    //Ball data (start at 9 because of double tab separator)
    var BallPosition = GetPosition(ThisLine.split(",").slice(9,12));
    var BallRotation = GetRotation(ThisLine.split(",").slice(13,17));
    
    //Create keyframe
    var Keyframe = new Object();
    Keyframe.CamZoom = CamZoom;
    Keyframe.CamPosX = CamPosition.X;
    Keyframe.CamPosY = CamPosition.Y;
    Keyframe.CamPosZ = CamPosition.Z;
    Keyframe.CamRotX = CamRotation.X;
    Keyframe.CamRotY = CamRotation.Y;
    Keyframe.CamRotZ = CamRotation.Z;
    Keyframe.BallPosX = BallPosition.X;
    Keyframe.BallPosY = BallPosition.Y;
    Keyframe.BallPosZ = BallPosition.Z;
    Keyframe.BallRotX = BallRotation.X;
    Keyframe.BallRotY = BallRotation.Y;
    Keyframe.BallRotZ = BallRotation.Z;
    
    return Keyframe;
}

//Zoom
function GetZoom(InFOV, MyComp)
{
    var AspectRatio = MyComp.width / MyComp.height;
    var FOV = parseFloat(InFOV);
    var FOVRads = (FOV / 2) * (Math.PI / 180);
    var Zoom = MyComp.width / (2 * Math.tan(FOVRads));
    
    return Zoom;
}

//Position
function GetPosition(PositionVals)
{
    var Position = new Object();
    Position.X = parseFloat(PositionVals[1]) *  2.54;
    Position.Y = parseFloat(PositionVals[2]) * -2.54;
    Position.Z = parseFloat(PositionVals[0]) *  2.54;
    
    return Position;
}

//Rotation
function GetRotation(QuatVals)
{
    //https://www.euclideanspace.com/maths/geometry/rotations/conversions/quaternionToEuler/
    
    var qX = parseFloat(QuatVals[0]);
    var qY = parseFloat(QuatVals[1]);
    var qZ = parseFloat(QuatVals[2]);
    var qW = parseFloat(QuatVals[3]);
    
    //Pitch
    var H1 = (2 * qY * qW) - (2 * qX * qZ);
    var H2 = 1 - (2 * qY * qY) - (2 * qZ * qZ);
    var Pitch = Math.atan2(H1, H2);
    
    //Yaw
    var A1 = 2 * qX * qY;
    var A2 = 2 * qZ * qW;
    var Yaw = Math.asin(A1 + A2);
    
    //Roll
    var B1 = (2 * qX * qW) - (2 * qY * qZ);
    var B2 = 1 - (2 * qX * qX) - (2 * qZ * qZ);
    var Roll = Math.atan2(B1, B2);
    
    //Convert from radians to degrees
    var RadToDeg = 180 / Math.PI;
    var NewPitch = Pitch * RadToDeg;
    var NewYaw   = Yaw   * RadToDeg;
    var NewRoll  = Roll  * RadToDeg;
    
    //Output the rotation
    var Rotation = new Object();
    Rotation.X = NewPitch * -1;
    Rotation.Y = NewYaw;
    Rotation.Z = NewRoll * -1;
    
    return Rotation;
}